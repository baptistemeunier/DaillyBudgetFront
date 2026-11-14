<script setup lang="ts">
// Every transaction not fully categorized, all accounts together, or only the checking accounts
// (?accounts=checking, from the budget) or the savings ones (?accounts=savings, from the savings tab).
// A row categorized here stays in the list (with its new label) until the next reload,
// so the list doesn't jump under the finger.
// Selection mode: tick several rows and give them one category at once (bulk sheet).
import { ChevronLeft } from 'lucide-vue-next'
import type { Transaction } from '~/types/api'

const router = useRouter()
const route = useRoute()
const scope = computed(() => (isAccountScope(route.query.accounts) ? route.query.accounts : null))

const {
  data: pages,
  isPending,
  isError,
  isFetchingNextPage,
  isFetchNextPageError,
  hasNextPage,
  fetchNextPage,
  refetch,
} = useUncategorizedTransactionsQuery(scope)

const { data: tree } = useCategoriesQuery()
const groups = useDayGroups(pages)
const isEmpty = computed(() => !isPending.value && !isError.value && groups.value.length === 0)

// Live counter: total from the API minus the rows categorized since.
const remaining = computed(() => {
  const total = pages.value?.pages[0]?.totalItems
  if (total == null) return null
  const done = groups.value
    .flatMap((g) => g.items)
    .filter((t) => !transactionRowCategory(t, tree.value).uncategorized).length
  return Math.max(0, total - done)
})

const selected = ref<Transaction | null>(null)

// Multiple selection (hrefs), limited to rows still to categorize.
const selecting = ref(false)
const selection = ref(new Set<string>())
const bulk = ref<Transaction[] | null>(null)

const loaded = computed(() => groups.value.flatMap((g) => g.items))
const isTodo = (t: Transaction) => transactionRowCategory(t, tree.value).uncategorized
const selectableItems = computed(() => loaded.value.filter(isTodo))
const allSelected = computed(
  () => selectableItems.value.length > 0 && selectableItems.value.every((t) => selection.value.has(t._links.self.href)),
)

function startSelecting() {
  selecting.value = true
  selection.value = new Set()
}

function stopSelecting() {
  selecting.value = false
  selection.value = new Set()
}

function toggleAll() {
  selection.value = allSelected.value ? new Set() : new Set(selectableItems.value.map((t) => t._links.self.href))
}

function onRowSelect(t: Transaction) {
  // Already categorized rows still open the single sheet (to adjust them).
  if (!selecting.value || !isTodo(t)) {
    selected.value = t
    return
  }
  const next = new Set(selection.value)
  const href = t._links.self.href
  if (next.has(href)) next.delete(href)
  else next.add(href)
  selection.value = next
}

function openBulk() {
  // Frozen copy: the sheet watches this array.
  bulk.value = loaded.value.filter((t) => selection.value.has(t._links.self.href))
}

function onSaved(hrefs: string[]) {
  if (!selecting.value) return
  const next = new Set(selection.value)
  for (const href of hrefs) next.delete(href)
  selection.value = next
  if (next.size === 0) selecting.value = false
}

function closeSheet() {
  selected.value = null
  bulk.value = null
}

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
          aria-label="Retour"
          @click="back"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="flex min-w-0 flex-1 flex-col">
          <h1 class="truncate text-lg font-bold">
            <template v-if="selecting">
              {{ selection.size }} sélectionnée{{ selection.size > 1 ? 's' : '' }}
            </template>
            <template v-else>À catégoriser</template>
          </h1>
          <p class="truncate text-[13px] text-slate-500" aria-live="polite">
            <template v-if="remaining != null">
              {{ remaining }} transaction{{ remaining > 1 ? 's' : '' }} restante{{ remaining > 1 ? 's' : '' }}
              ·
            </template>
            {{ scope ? ACCOUNT_SCOPES[scope].label : 'Tous comptes' }}
          </p>
        </div>
        <template v-if="selecting">
          <button
            type="button"
            class="min-h-11 flex-none rounded-full px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
            @click="toggleAll"
          >
            {{ allSelected ? 'Aucune' : 'Tout' }}
          </button>
          <button
            type="button"
            class="-mr-2 min-h-11 flex-none rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            @click="stopSelecting"
          >
            Annuler
          </button>
        </template>
        <button
          v-else-if="selectableItems.length"
          type="button"
          class="-mr-2 min-h-11 flex-none rounded-full px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          @click="startSelecting"
        >
          Sélectionner
        </button>
      </div>
    </header>

    <main ref="scroller" class="flex-1 overflow-y-auto px-4" :class="selecting ? 'pb-24' : 'pb-6'">
      <div v-if="isPending" class="mt-4 flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="h-16 animate-pulse rounded-2xl bg-white" />
      </div>

      <div v-else-if="isError" class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">Impossible de charger les transactions.</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          Réessayer
        </button>
      </div>

      <div v-else-if="isEmpty" class="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
        <p class="text-[15px] font-semibold">Tout est catégorisé 🎉</p>
        <NuxtLink to="/" class="text-sm font-semibold text-indigo-700">Retour à l'accueil</NuxtLink>
      </div>

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
              <TransactionRow
                :transaction="t"
                show-account
                :selectable="selecting && isTodo(t)"
                :selected="selection.has(t._links.self.href)"
                @select="onRowSelect(t)"
              />
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

        <div v-if="hasNextPage" ref="sentinel" class="h-px" aria-hidden="true" />
      </template>
    </main>

    <!-- Bulk action bar -->
    <div
      v-if="selecting"
      class="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md justify-center border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"
    >
      <button
        type="button"
        class="inline-flex h-11 w-full items-center justify-center rounded-full bg-indigo-600 text-[15px] font-semibold text-white disabled:opacity-40"
        :disabled="selection.size === 0"
        @click="openBulk"
      >
        Catégoriser{{ selection.size ? ` (${selection.size})` : '' }}
      </button>
    </div>

    <CategorizeSheet :transaction="selected" :transactions="bulk" @saved="onSaved" @close="closeSheet" />
  </div>
</template>
