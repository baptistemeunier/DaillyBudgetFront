<script setup lang="ts">
// Transactions with a split on one category (sub-category, or a root used directly) over the period.
import { ChevronLeft } from 'lucide-vue-next'
import type { Transaction } from '~/types/api'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = computed(() => String(route.params.id))

const { view, query: periodQuery, period, label: periodText } = useStatementPeriod()
const { data: tree } = useCategoriesQuery()
const { data: statement } = useStatementQuery(period)

const node = computed(() => [...(tree.value?.byIri.values() ?? [])].find((n) => iriId(n.iri) === id.value))
const parent = computed(() => (node.value?.parentIri ? tree.value?.byIri.get(node.value.parentIri) : undefined))

const title = computed(() => node.value?.label ?? t('common.category'))
const subtitle = computed(() =>
  [parent.value?.label ?? (node.value ? t('budgetCategory.noSubShort') : null), periodText.value]
    .filter(Boolean)
    .join(' · '),
)

// Total + count from the statement details (the list below may be paginated).
const detail = computed(() =>
  statement.value?.details?.find((d) => {
    const iri = detailIris(d).category
    return iri && iriId(iri) === id.value
  }),
)
const currency = computed(() => statement.value?.currency ?? 'EUR')

const {
  data: pages,
  isPending,
  isError,
  isFetchingNextPage,
  isFetchNextPageError,
  hasNextPage,
  fetchNextPage,
  refetch,
} = useCategoryTransactionsQuery(id, period)

const groups = useDayGroups(pages)
const isEmpty = computed(() => !isPending.value && !isError.value && groups.value.length === 0)

// Distinct accounts, once every page is loaded.
const accountCount = computed(() => {
  if (hasNextPage.value || !pages.value) return null
  const hrefs = new Set(
    groups.value.flatMap((g) => g.items).map((t) => t._links.account?.href ?? t._links.self.href),
  )
  return hrefs.size
})

const headline = computed(() => {
  const parts = [t('common.transactionCount', detail.value?.transactionCount ?? 0)]
  if (accountCount.value) parts.push(t('common.accountCount', accountCount.value))
  return parts.join(' · ')
})

const selected = ref<Transaction | null>(null)

const scroller = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
useInfiniteScroll(scroller, sentinel, { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage })

function back() {
  if (window.history.state?.back) router.back()
  else if (parent.value) router.push({ path: `/budget/category/${iriId(parent.value.iri)}`, query: periodQuery.value })
  else router.push({ path: '/budget', query: periodQuery.value })
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
        <div class="flex min-w-0 flex-col">
          <h1 class="truncate text-lg font-bold">{{ title }}</h1>
          <p class="truncate text-[13px] text-slate-500">{{ subtitle }}</p>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p class="text-[13px] text-slate-500">{{ view === 'income' ? $t('budget.received') : $t('budget.spent') }}</p>
          <p class="text-[28px] leading-tight font-bold tabular-nums">
            {{ detail ? formatCents(toCents(detail.amount), currency) : '—' }}
          </p>
        </div>
        <p v-if="detail" class="text-[13px] text-slate-500">{{ headline }}</p>
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

      <p v-else-if="isEmpty" class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
        {{ $t('budgetCategory.noTransactions') }}
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
              <TransactionRow :transaction="t" show-account @select="selected = t" />
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
