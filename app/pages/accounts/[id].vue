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
const { data: categoryTree } = useCategoriesQuery()
const selected = ref<Transaction | null>(null)

function rowCategory(t: Transaction): { emoji: string; label: string; uncategorized: boolean } {
  const status = categorizationStatus(t, categoryTree.value)
  switch (status.kind) {
    case 'none':
      return { emoji: '❔', label: 'Non catégorisé', uncategorized: true }
    case 'partial':
      return {
        emoji: status.main?.emoji ?? '❔',
        label: `Partiellement catégorisé · ${formatCents(Math.abs(status.remainingCents), t.currency)} restant`,
        uncategorized: true,
      }
    case 'single':
      return { emoji: status.main?.emoji ?? '🏷️', label: status.main?.label ?? 'Catégorie', uncategorized: false }
    case 'split':
      return { emoji: status.main?.emoji ?? '🏷️', label: `Ventilé · ${status.count} catégories`, uncategorized: false }
  }
}

const balance = computed(() =>
  account.value?.balanceAmount != null
    ? formatCents(toCents(account.value.balanceAmount), account.value.balanceCurrency ?? 'EUR')
    : null,
)

// Merge pages first (a day can be split across two pages), dedupe, then group by Paris day.
interface DayGroup {
  key: string
  label: string
  totals: string
  items: Transaction[]
}

const groups = computed<DayGroup[]>(() => {
  const seen = new Set<string>()
  const byDay = new Map<string, Transaction[]>()

  for (const page of pages.value?.pages ?? []) {
    for (const t of halItems(page)) {
      if (seen.has(t._links.self.href)) continue
      seen.add(t._links.self.href)
      const key = t.bookingAt ? dayKey(t.bookingAt) : 'unknown'
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(t)
    }
  }

  return [...byDay.entries()].map(([key, items]) => {
    // One total per currency (usually just one).
    const sums = new Map<string, number>()
    for (const t of items) sums.set(t.currency, (sums.get(t.currency) ?? 0) + toCents(t.amount))
    return {
      key,
      label: key === 'unknown' ? 'Date inconnue' : dayLabel(key),
      totals: [...sums].map(([cur, cents]) => formatSignedCents(cents, cur)).join(' · '),
      items,
    }
  })
})

const isEmpty = computed(() => !isPending.value && !isError.value && groups.value.length === 0)

// Infinite scroll: sentinel ~160 px before the end of the scroll container.
const scroller = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasNextPage.value && !isFetchingNextPage.value && !isFetchNextPageError.value) {
        fetchNextPage()
      }
    },
    { root: scroller.value, rootMargin: '0px 0px 160px 0px' },
  )
})
onBeforeUnmount(() => observer?.disconnect())

watch(sentinel, (el, old) => {
  if (old) observer?.unobserve(old)
  if (el) observer?.observe(el)
})

// A page that doesn't fill the screen leaves the sentinel visible: re-observe
// so the observer fires again (observe() always reports the current state).
watch(isFetchingNextPage, (fetching) => {
  if (fetching || !sentinel.value || !observer) return
  observer.unobserve(sentinel.value)
  observer.observe(sentinel.value)
})

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
          aria-label="Retour"
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
        Impossible de charger ce compte.
      </p>

      <div v-else class="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div v-if="balance">
          <p class="text-[13px] text-slate-500">Solde</p>
          <p class="text-[28px] leading-tight font-bold tabular-nums">{{ balance }}</p>
        </div>
        <p v-if="syncing" class="flex items-center gap-1.5 text-[13px] font-medium text-indigo-700">
          <RefreshCw class="size-3.5 animate-spin" aria-hidden="true" /> Synchronisation…
        </p>
        <p v-else-if="account?.synchronizedAt" class="flex items-center gap-1.5 text-[13px] text-slate-500">
          <span
            class="size-2 rounded-full"
            :class="account.synchronizedStatus === 'FAILED' ? 'bg-rose-500' : 'bg-emerald-500'"
            aria-hidden="true"
          />
          {{ account.synchronizedStatus === 'FAILED' ? 'Échec de la synchro' : 'Synchronisé' }}
          {{ relativeTime(account.synchronizedAt) }}
        </p>
      </div>
    </header>

    <!-- Scrollable list -->
    <main ref="scroller" class="flex-1 overflow-y-auto px-4 pb-6">
      <p v-if="syncing" class="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800">Synchro en cours…</p>

      <div v-if="isPending" class="mt-4 flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="h-16 animate-pulse rounded-2xl bg-white" />
      </div>

      <div v-else-if="isError" class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">Impossible de charger les transactions.</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          Réessayer
        </button>
      </div>

      <p v-else-if="isEmpty" class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
        Aucune transaction pour l'instant.
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
              <button
                type="button"
                class="flex min-h-16 w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50"
                aria-haspopup="dialog"
                @click="selected = t"
              >
                <span
                  aria-hidden="true"
                  class="flex size-10 flex-none items-center justify-center rounded-full text-lg"
                  :class="rowCategory(t).uncategorized ? 'bg-amber-50' : 'bg-slate-100'"
                >
                  {{ rowCategory(t).emoji }}
                </span>
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="truncate text-[15px] font-medium">{{ t.description }}</span>
                  <span
                    class="truncate text-[13px]"
                    :class="rowCategory(t).uncategorized ? 'text-amber-700' : 'text-slate-500'"
                  >
                    {{ rowCategory(t).label }}
                  </span>
                </span>
                <span
                  class="flex-none text-[15px] font-semibold tabular-nums"
                  :class="toCents(t.amount) > 0 ? 'text-emerald-700' : 'text-slate-900'"
                >
                  {{ formatSignedCents(toCents(t.amount), t.currency) }}
                </span>
              </button>
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
          <span class="text-sm text-rose-800">Chargement interrompu.</span>
          <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="fetchNextPage()">
            Réessayer
          </button>
        </div>

        <p v-else-if="!hasNextPage" class="py-6 text-center text-[13px] text-slate-500">
          Début de l'historique synchronisé
        </p>

        <div v-if="hasNextPage" ref="sentinel" class="h-px" aria-hidden="true" />
      </template>
    </main>

    <CategorizeSheet :transaction="selected" :account-id="id" @close="selected = null" />
  </div>
</template>
