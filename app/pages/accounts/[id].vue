<script setup lang="ts">
import { ChevronLeft, RefreshCw } from 'lucide-vue-next'
import type { Transaction } from '~/types/api'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const { data: account, isError: accountError } = useAccountQuery(id)
const { data: bank } = useBankQuery(() => account.value?._links.bank?.href)
const {
  data: pages,
  isPending,
  isError,
  isFetchingNextPage,
  isFetchNextPageError,
  hasNextPage,
  fetchNextPage,
  refetch,
} = useTransactionsQuery(id)

const syncing = computed(
  () => account.value?.synchronizedStatus === 'PENDING' || account.value?.synchronizedStatus === 'IN_PROGRESS',
)

// Sync just finished: reload the list.
watch(syncing, (now, before) => {
  if (before && !now) refetch()
})

// Categorization
const selected = ref<Transaction | null>(null)

const balance = computed(() =>
  account.value?.balance != null
    ? formatCents(toCents(account.value.balance), account.value.balanceCurrency ?? 'EUR')
    : null,
)

const groups = useDayGroups(pages)

const isEmpty = computed(() => !isPending.value && !isError.value && groups.value.length === 0)

// Infinite scroll
const scroller = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
useInfiniteScroll(scroller, sentinel, { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage })

function back() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}
</script>

<template>
  <div class="flex h-dvh flex-col">
    <!-- Fixed header -->
    <header class="flex-none border-b border-slate-200 bg-white px-4 pt-3 pb-4">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="-ml-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
          :aria-label="$t('common.back')"
          @click="back"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="flex min-w-0 flex-col">
          <h1 class="truncate text-lg font-bold">
            <span v-if="account">{{ accountName(account) }}</span>
            <span v-else class="inline-block h-5 w-40 animate-pulse rounded bg-slate-100 align-middle" />
          </h1>
          <p class="truncate text-[13px] text-slate-500">
            {{ [bank?.name, maskIban(account?.iban ?? null)].filter(Boolean).join(' · ') }}
          </p>
        </div>
      </div>

      <p v-if="accountError" class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {{ $t('errors.loadAccount') }}
      </p>

      <div v-else class="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div v-if="balance">
          <p class="text-[13px] text-slate-500">
            {{ $t('common.balance') }}<template v-if="account?.balanceAt"> · {{ dayLabel(dayKey(account.balanceAt)) }}</template>
          </p>
          <p class="text-[28px] leading-tight font-bold tabular-nums">{{ balance }}</p>
        </div>
        <p v-if="syncing" class="flex items-center gap-1.5 text-[13px] font-medium text-indigo-700">
          <RefreshCw class="size-3.5 animate-spin" aria-hidden="true" /> {{ $t('sync.syncing') }}
        </p>
        <p v-else-if="account?.synchronizedAt" class="flex items-center gap-1.5 text-[13px] text-slate-500">
          <span
            class="size-2 rounded-full"
            :class="account.synchronizedStatus === 'FAILED' ? 'bg-rose-500' : 'bg-emerald-500'"
            aria-hidden="true"
          />
          {{
            $t(account.synchronizedStatus === 'FAILED' ? 'sync.failedAgo' : 'sync.syncedAgo', {
              when: relativeTime(account.synchronizedAt),
            })
          }}
        </p>
      </div>
    </header>

    <!-- Scrollable list -->
    <main ref="scroller" class="flex-1 overflow-y-auto px-4 pb-6">
      <p v-if="syncing" class="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800">{{ $t('sync.inProgress') }}</p>

      <div v-if="isPending" class="mt-4 flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="h-16 animate-pulse rounded-2xl bg-white" />
      </div>

      <div v-else-if="isError" class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">{{ $t('errors.loadTransactions') }}</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          {{ $t('common.retry') }}
        </button>
      </div>

      <p v-else-if="isEmpty" class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
        {{ $t('account.noTransactions') }}
      </p>

      <template v-else>
        <section v-for="group in groups" :key="group.key" :aria-labelledby="`day-${group.key}`">
          <h2
            :id="`day-${group.key}`"
            class="sticky top-0 z-10 flex items-center justify-between bg-slate-50 pt-4 pb-2 text-[13px] font-semibold text-slate-600"
          >
            <span>{{ group.label }}</span>
            <span class="tabular-nums">{{ group.totals }}</span>
          </h2>
          <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <li v-for="t in group.items" :key="t._links.self.href">
              <TransactionRow :transaction="t" @select="selected = t" />
            </li>
          </ul>
        </section>

        <div v-if="isFetchingNextPage" class="mt-3 flex flex-col gap-2" aria-hidden="true">
          <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-2xl bg-white" />
        </div>

        <div
          v-else-if="isFetchNextPageError"
          class="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3"
        >
          <span class="text-sm text-rose-800">{{ $t('common.loadInterrupted') }}</span>
          <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="fetchNextPage()">
            {{ $t('common.retry') }}
          </button>
        </div>

        <p v-else-if="!hasNextPage" class="py-6 text-center text-[13px] text-slate-500">
          {{ $t('account.historyStart') }}
        </p>

        <div v-if="hasNextPage" ref="sentinel" class="h-px" aria-hidden="true" />
      </template>
    </main>

    <CategorizeSheet :transaction="selected" @close="selected = null" />
  </div>
</template>
