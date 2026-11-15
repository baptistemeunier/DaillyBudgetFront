<script setup lang="ts">
// Transactions categorized by a rule, to review: "Confirmer" sends {confirm: true} (the splits become "confirmed"),
// a tap on the row opens CategorizeSheet to correct it. "Tout confirmer" confirms every loaded row.
// A reviewed row stays in the list (marked "Vérifiée") until the next reload, so the list doesn't jump.
import { Check, ChevronLeft, Loader2 } from 'lucide-vue-next'
import type { Transaction } from '~/types/api'

const router = useRouter()
const i18n = useI18n()

const {
  data: pages,
  isPending,
  isError,
  isFetchingNextPage,
  isFetchNextPageError,
  hasNextPage,
  fetchNextPage,
  refetch,
} = useAutoCategorizedTransactionsQuery()

const groups = useDayGroups(pages)
const loaded = computed(() => groups.value.flatMap((g) => g.items))
const toReview = computed(() => loaded.value.filter(isAutoCategorized))
const isEmpty = computed(() => !isPending.value && !isError.value && groups.value.length === 0)

// Live counter: total from the API minus the rows reviewed since.
const remaining = computed(() => {
  const total = pages.value?.pages[0]?.totalItems
  if (total == null) return null
  return Math.max(0, total - (loaded.value.length - toReview.value.length))
})

const confirmation = useConfirmTransaction()
const confirming = ref(new Set<string>())
const confirmingAll = ref(false)
const error = ref<string | null>(null)

async function confirmOne(t: Transaction) {
  const href = t._links.self.href
  confirming.value = new Set(confirming.value).add(href)
  try {
    await confirmation.mutateAsync(t)
  } finally {
    const next = new Set(confirming.value)
    next.delete(href)
    confirming.value = next
  }
}

async function confirm(t: Transaction) {
  error.value = null
  try {
    await confirmOne(t)
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function confirmAll() {
  const items = toReview.value
  if (!items.length || confirmingAll.value) return
  error.value = null
  confirmingAll.value = true
  try {
    const results = await Promise.allSettled(items.map(confirmOne))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) error.value = i18n.t('toReview.confirmAllFailed', { failed, total: items.length }, failed)
  } finally {
    confirmingAll.value = false
  }
}

const selected = ref<Transaction | null>(null)

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
        <div class="flex min-w-0 flex-1 flex-col">
          <h1 class="truncate text-lg font-bold">{{ $t('toReview.title') }}</h1>
          <p v-if="remaining != null" class="truncate text-[13px] text-slate-500" aria-live="polite">
            {{ $t('toReview.remaining', remaining) }}
          </p>
        </div>
        <button
          v-if="toReview.length"
          type="button"
          class="-mr-2 inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          :disabled="confirmingAll"
          @click="confirmAll"
        >
          <Loader2 v-if="confirmingAll" class="size-4 animate-spin" aria-hidden="true" />
          {{ $t('toReview.confirmAll') }}
        </button>
      </div>
    </header>

    <main ref="scroller" class="flex-1 overflow-y-auto px-4 pb-6">
      <div v-if="isPending" class="mt-4 flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="h-16 animate-pulse rounded-2xl bg-white" />
      </div>

      <div v-else-if="isError" class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">{{ $t('errors.loadTransactions') }}</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          {{ $t('common.retry') }}
        </button>
      </div>

      <div v-else-if="isEmpty" class="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
        <p class="text-[15px] font-semibold">{{ $t('toReview.done') }}</p>
        <NuxtLink to="/" class="text-sm font-semibold text-indigo-700">{{ $t('toCategorize.backHome') }}</NuxtLink>
      </div>

      <template v-else>
        <p class="mt-4 text-sm text-slate-600">
          {{ $t('toReview.intro') }}
          <NuxtLink to="/profile/rules" class="font-semibold whitespace-nowrap text-indigo-700">{{ $t('toReview.rules') }}</NuxtLink>
        </p>
        <p v-if="error" class="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

        <section v-for="group in groups" :key="group.key" :aria-labelledby="`day-${group.key}`">
          <h2
            :id="`day-${group.key}`"
            class="sticky top-0 z-10 flex items-center justify-between bg-slate-50 pt-4 pb-2 text-[13px] font-semibold text-slate-600"
          >
            <span>{{ group.label }}</span>
            <span class="tabular-nums">{{ group.totals }}</span>
          </h2>
          <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <li v-for="t in group.items" :key="t._links.self.href" class="flex items-center">
              <div class="min-w-0 flex-1">
                <TransactionRow :transaction="t" show-account @select="selected = t" />
              </div>
              <button
                v-if="isAutoCategorized(t)"
                type="button"
                class="mr-2 inline-flex min-h-11 flex-none items-center gap-1 rounded-full bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                :aria-label="$t('toReview.confirmNamed', { name: t.description })"
                :disabled="confirming.has(t._links.self.href)"
                @click="confirm(t)"
              >
                <Loader2 v-if="confirming.has(t._links.self.href)" class="size-4 animate-spin" aria-hidden="true" />
                <Check v-else class="size-4" aria-hidden="true" />
                {{ $t('toReview.confirm') }}
              </button>
              <span v-else class="mr-3 inline-flex flex-none items-center gap-1 text-xs font-semibold text-emerald-700">
                <Check class="size-4" aria-hidden="true" />
                {{ $t('toReview.confirmed') }}
              </span>
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

        <div v-if="hasNextPage" ref="sentinel" class="h-px" aria-hidden="true" />
      </template>
    </main>

    <CategorizeSheet :transaction="selected" @close="selected = null" />
  </div>
</template>
