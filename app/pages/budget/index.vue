<script setup lang="ts">
// Where the money goes over a period of whole months, compared to the budget.
// State lives in the URL (?months=3&to=2026-11&view=income) so back / reload keep the view.
import { ChevronRight } from 'lucide-vue-next'
import type { DonutSegment, StatementRowView } from '~/types/statement'
import type { StatementLine } from '~/types/api'
import { PERIOD_LENGTHS, type PeriodLength } from '~/utils/period'

definePageMeta({ tabs: true })

const { months, to, view, query: periodQuery, setQuery, shift, canGoNext, period, label } = useStatementPeriod()
const { data: statement, isPending, isError, isPlaceholderData, refetch } = useStatementQuery(period)
const { data: tree } = useCategoriesQuery()

const currency = computed(() => statement.value?.currency ?? 'EUR')
const isExpenses = computed(() => view.value === 'expenses')

// --- Rows (list) + segments (donut) ---------------------------------------
const rows = computed<StatementRowView[]>(() => {
  const s = statement.value
  if (!s) return []
  const lines: StatementLine[] = isExpenses.value ? s.lines : s.income
  const result: StatementRowView[] = []
  for (const line of lines) {
    const iri = splitCategoryIri(line)
    const id = iri ? iriId(iri) : null
    const node = iri ? tree.value?.byIri.get(iri) : undefined
    const cents = toCents(line.amount)
    const targetCents = line.targetAmount ? toCents(line.targetAmount) : 0
    // Nothing spent and nothing planned: not worth a row
    if (cents <= 0 && targetCents <= 0) continue
    result.push({
      key: iri ?? `line-${result.length}`,
      emoji: node?.emoji ?? '🏷️',
      label: node?.label ?? 'Catégorie',
      color: categoryColor(node?.code ?? null) ?? OTHER_COLOR,
      cents,
      targetCents: targetCents > 0 ? targetCents : null,
      count: line.transactionCount ?? 0,
      // Against the category budget; an expense outside the budget counts against 1 € (95,35 € -> 9535 %)
      percent:
        targetCents > 0
          ? Math.round((cents / targetCents) * 100)
          : isExpenses.value && cents > 0
            ? cents
            : null,
      currency: currency.value,
      to: id ? { path: `/budget/category/${id}`, query: periodQuery.value } : undefined,
    })
  }

  const uncategorized = toCents(isExpenses.value ? s.uncategorizedAmount : s.uncategorizedIncomeAmount)
  if (uncategorized > 0) {
    result.push({
      key: 'uncategorized',
      emoji: '❔',
      label: 'Non catégorisé',
      color: UNCATEGORIZED_COLOR,
      cents: uncategorized,
      targetCents: null,
      count: (isExpenses.value ? s.uncategorizedCount : s.uncategorizedIncomeCount) ?? 0,
      percent: null,
      currency: currency.value,
      to: '/transactions/to-categorize',
    })
  }

  return result.sort((a, b) => b.cents - a.cents)
})

// Categories without a chart color fold into one "Autres" segment.
const segments = computed<DonutSegment[]>(() => {
  const result: DonutSegment[] = []
  let other = 0
  for (const row of rows.value) {
    if (row.cents <= 0) continue
    if (row.color === OTHER_COLOR) other += row.cents
    else result.push({ key: row.key, label: row.label, color: row.color, cents: row.cents })
  }
  if (other > 0) result.push({ key: 'other', label: 'Autres', color: OTHER_COLOR, cents: other })
  return result.sort((a, b) => b.cents - a.cents)
})

const totalCents = computed(() =>
  statement.value ? toCents(isExpenses.value ? statement.value.amount : statement.value.incomeAmount) : 0,
)

const donutLabel = computed(() => {
  const top = segments.value
    .slice(0, 3)
    .map((s) => `${s.label} ${formatCents(s.cents, currency.value)}`)
    .join(', ')
  return `${isExpenses.value ? 'Dépenses' : 'Revenus'} : ${formatCents(totalCents.value, currency.value)}${top ? `. Principaux postes : ${top}` : ''}`
})

// --- Budget card ----------------------------------------------------------
const targetCents = computed(() => (statement.value ? toCents(statement.value.targetAmount) : 0))
const ratio = computed(() => (targetCents.value > 0 ? totalCents.value / targetCents.value : 0))
const budgetPercent = computed(() => Math.round(ratio.value * 100))
const budgetBar = computed(() => budgetStatusColor(ratio.value))
const budgetText = computed(() => budgetStatusText(ratio.value))
const days = computed(() => daysLeft(to.value))
const budgetFooter = computed(() => {
  const diff = targetCents.value - totalCents.value
  const amount =
    diff >= 0 ? `Reste ${formatCents(diff, currency.value)}` : `Dépassé de ${formatCents(-diff, currency.value)}`
  if (days.value === null) return amount
  return `${amount} · ${days.value} jour${days.value > 1 ? 's' : ''} restant${days.value > 1 ? 's' : ''}`
})

const lengthLabel = (n: PeriodLength) => (n === 12 ? '1 an' : `${n} mois`)
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pt-8 pb-24">
    <h1 class="text-[28px] font-bold">Budget</h1>

    <!-- Period + view -->
    <section class="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3" aria-label="Période">
      <PeriodNav :label="label" :can-go-next="canGoNext" @shift="shift" />

      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="n in PERIOD_LENGTHS"
          :key="n"
          type="button"
          class="h-10 rounded-full border text-sm font-semibold"
          :class="n === months ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
          :aria-pressed="n === months"
          @click="setQuery({ months: n })"
        >
          {{ lengthLabel(n) }}
        </button>
      </div>

      <div class="grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm font-semibold" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="isExpenses"
          class="h-10 rounded-full"
          :class="isExpenses ? 'bg-indigo-600 text-white' : 'text-slate-600'"
          @click="setQuery({ view: 'expenses' })"
        >
          Dépenses
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="!isExpenses"
          class="h-10 rounded-full"
          :class="!isExpenses ? 'bg-indigo-600 text-white' : 'text-slate-600'"
          @click="setQuery({ view: 'income' })"
        >
          Revenus
        </button>
      </div>
    </section>

    <template v-if="isPending">
      <div class="h-72 animate-pulse rounded-3xl bg-white" aria-hidden="true" />
      <div class="h-24 animate-pulse rounded-3xl bg-white" aria-hidden="true" />
    </template>

    <div v-else-if="isError" class="flex items-center justify-between gap-3 rounded-3xl bg-rose-50 px-4 py-4">
      <span class="text-sm text-rose-800">Impossible de charger le budget.</span>
      <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
        Réessayer
      </button>
    </div>

    <div v-else class="flex flex-col gap-4 transition-opacity" :class="{ 'opacity-60': isPlaceholderData }">
      <!-- Donut -->
      <section class="rounded-3xl border border-slate-200 bg-white p-5">
        <StatementDonut
          :segments="segments"
          :total="formatCents(totalCents, currency)"
          :caption="isExpenses ? 'Dépenses' : 'Revenus'"
          :aria-label="donutLabel"
        />
      </section>

      <!-- Budget -->
      <template v-if="isExpenses">
        <NuxtLink
          v-if="targetCents > 0"
          to="/budget/edit"
          class="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
        >
          <span class="flex items-center gap-2">
            <span class="text-[15px] font-semibold">Budget</span>
            <span class="size-2 rounded-full" :class="budgetBar" aria-hidden="true" />
            <span class="ml-auto text-[15px] tabular-nums">
              <span class="font-bold">{{ formatCents(totalCents, currency) }}</span>
              <span class="text-slate-500"> / {{ formatCents(targetCents, currency) }}</span>
            </span>
            <ChevronRight class="size-5 flex-none text-slate-400" aria-hidden="true" />
          </span>
          <span class="block h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span class="block h-full rounded-full" :class="budgetBar" :style="{ width: `${Math.min(100, ratio * 100)}%` }" />
          </span>
          <span class="flex items-center justify-between text-[13px]">
            <span class="text-slate-500">{{ budgetFooter }}</span>
            <span class="font-semibold tabular-nums" :class="budgetText">{{ budgetPercent }} %</span>
          </span>
        </NuxtLink>
        <NuxtLink
          v-else
          to="/budget/edit"
          class="flex items-center justify-between gap-3 rounded-3xl border border-dashed border-indigo-200 bg-indigo-50 p-4"
        >
          <span class="flex flex-col">
            <span class="text-[15px] font-semibold text-indigo-700">Définir mon budget</span>
            <span class="text-[13px] text-indigo-700/80">Fixez un montant mensuel et répartissez-le par catégorie.</span>
          </span>
          <ChevronRight class="size-5 flex-none text-indigo-700" aria-hidden="true" />
        </NuxtLink>
      </template>

      <!-- Categories (also the donut legend) -->
      <section class="rounded-3xl border border-slate-200 bg-white px-4 py-1" aria-label="Par catégorie">
        <p v-if="!rows.length" class="py-6 text-center text-sm text-slate-500">
          {{ isExpenses ? 'Aucune dépense sur cette période.' : 'Aucun revenu sur cette période.' }}
        </p>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="row in rows" :key="row.key">
            <StatementRow :row="row" />
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
