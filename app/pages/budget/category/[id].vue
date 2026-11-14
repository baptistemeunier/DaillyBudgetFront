<script setup lang="ts">
// A root category over the period: spent vs its budget, then one row per sub-category
// (from the statement details; sub-categories without movement shown at 0).
import { ChevronLeft } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { StatementRowView } from '~/types/statement'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const { view, query: periodQuery, shift, canGoNext, period, label } = useStatementPeriod()
const { data: statement, isPending, isError, isPlaceholderData, refetch } = useStatementQuery(period)
const { data: tree } = useCategoriesQuery()

const isExpenses = computed(() => view.value === 'expenses')
const currency = computed(() => statement.value?.currency ?? 'EUR')
const root = computed(() => [...(tree.value?.byIri.values() ?? [])].find((n) => iriId(n.iri) === id.value))
const color = computed(() => categoryColor(root.value?.code ?? null) ?? OTHER_COLOR)

// Line of the root in the statement (amount + prorated target).
const line = computed(() => {
  const s = statement.value
  if (!s) return undefined
  return [...s.lines, ...s.income].find((l) => {
    const iri = splitCategoryIri(l)
    return iri && iriId(iri) === id.value
  })
})
const totalCents = computed(() => (line.value ? toCents(line.value.amount) : 0))
const targetCents = computed(() => (line.value?.targetAmount ? toCents(line.value.targetAmount) : 0))
const ratio = computed(() => (targetCents.value > 0 ? totalCents.value / targetCents.value : 0))

const rows = computed<StatementRowView[]>(() => {
  const r = root.value
  if (!r) return []
  const percent = (cents: number) => (totalCents.value > 0 ? Math.round((cents / totalCents.value) * 100) : 0)
  const byCategory = new Map<string, { cents: number; count: number }>()
  for (const d of statement.value?.details ?? []) {
    const { category, parent } = detailIris(d)
    if (category && parent && iriId(parent) === id.value) {
      byCategory.set(category, { cents: toCents(d.amount), count: d.transactionCount ?? 0 })
    }
  }

  const row = (iri: string, labelText: string, icon: Component): StatementRowView => {
    const data = byCategory.get(iri) ?? { cents: 0, count: 0 }
    return {
      key: iri,
      icon,
      label: labelText,
      color: color.value,
      cents: data.cents,
      targetCents: null,
      count: data.count,
      percent: percent(data.cents),
      currency: currency.value,
      to: data.count > 0 ? { path: `/budget/transactions/${iriId(iri)}`, query: periodQuery.value } : undefined,
    }
  }

  const result = r.children.map((child) => row(child.iri, child.label, child.icon))
  // Splits made directly on the root (no sub-category)
  if (byCategory.has(r.iri)) result.push(row(r.iri, `${r.label} (sans sous-catégorie)`, r.icon))
  return result.sort((a, b) => b.cents - a.cents)
})

function back() {
  if (window.history.state?.back) router.back()
  else router.push({ path: '/budget', query: periodQuery.value })
}
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pt-4 pb-8">
    <header class="flex items-center gap-2">
      <button
        type="button"
        class="-ml-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
        aria-label="Retour"
        @click="back"
      >
        <ChevronLeft class="size-5" />
      </button>
      <span
        v-if="root"
        aria-hidden="true"
        class="flex size-10 flex-none items-center justify-center rounded-full text-lg"
        :style="{ backgroundColor: `${color}26` }"
      >
        <component :is="root.icon" v-if="root" class="size-5" :style="{ color }" />
      </span>
      <h1 class="truncate text-xl font-bold">{{ root?.label ?? 'Catégorie' }}</h1>
    </header>

    <!-- Period + total -->
    <section class="rounded-3xl border border-slate-200 bg-white">
      <div class="border-b border-slate-100 p-3">
        <PeriodNav :label="label" :can-go-next="canGoNext" @shift="shift" />
      </div>
      <div v-if="isPending" class="m-4 h-16 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
      <div v-else class="flex flex-col gap-2 p-4 transition-opacity" :class="{ 'opacity-60': isPlaceholderData }">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-[32px] leading-tight font-bold tabular-nums">{{ formatCents(totalCents, currency) }}</span>
          <span v-if="targetCents > 0" class="text-[13px] text-slate-500 tabular-nums">
            sur {{ formatCents(targetCents, currency) }}
          </span>
        </div>
        <template v-if="targetCents > 0">
          <span class="block h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span
              class="block h-full rounded-full"
              :class="budgetStatusColor(ratio)"
              :style="{ width: `${Math.min(100, ratio * 100)}%` }"
            />
          </span>
          <span class="flex items-center justify-between text-[13px]">
            <span class="text-slate-500">
              <template v-if="targetCents >= totalCents">Reste {{ formatCents(targetCents - totalCents, currency) }}</template>
              <template v-else>Dépassé de {{ formatCents(totalCents - targetCents, currency) }}</template>
            </span>
            <span class="font-semibold tabular-nums" :class="budgetStatusText(ratio)">{{ Math.round(ratio * 100) }} %</span>
          </span>
        </template>
        <template v-else>
          <!-- Spending outside the budget = fully over budget -->
          <span v-if="isExpenses && totalCents > 0" class="block h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span class="block h-full w-full rounded-full bg-rose-500" />
          </span>
          <span class="text-[13px] text-slate-500">{{ isExpenses ? 'Dépensé' : 'Reçu' }} · hors budget</span>
        </template>
      </div>
    </section>

    <div v-if="isError" class="flex items-center justify-between gap-3 rounded-3xl bg-rose-50 px-4 py-4">
      <span class="text-sm text-rose-800">Impossible de charger la catégorie.</span>
      <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
        Réessayer
      </button>
    </div>

    <!-- Sub-categories -->
    <section
      v-else-if="!isPending"
      class="rounded-3xl border border-slate-200 bg-white px-4 pt-4 pb-1 transition-opacity"
      :class="{ 'opacity-60': isPlaceholderData }"
      aria-labelledby="sub-title"
    >
      <h2 id="sub-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Sous-catégories</h2>
      <p v-if="!rows.length" class="py-6 text-center text-sm text-slate-500">Aucune sous-catégorie.</p>
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="row in rows" :key="row.key">
          <StatementRow :row="row" share />
        </li>
      </ul>
    </section>
  </main>
</template>
