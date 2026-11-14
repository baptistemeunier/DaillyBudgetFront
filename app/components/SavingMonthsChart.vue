<script setup lang="ts">
// Saving in (Entrées) and out (Sorties) per month: paired bars, net below each month.
// Hover / focus a month for its exact amounts; a hidden table carries the same data.
import type { SavingMonth } from '~/types/api'

const props = defineProps<{ months: SavingMonth[]; currency: string; current: string }>()

const rows = computed(() =>
  props.months.map((m) => {
    const credit = toCents(m.creditAmount)
    const debit = toCents(m.debitAmount)
    return { month: m.month, credit, debit, net: credit - debit }
  }),
)
const max = computed(() => Math.max(1, ...rows.value.flatMap((r) => [r.credit, r.debit])))
const PLOT = 112 // px
const height = (cents: number) => (cents > 0 ? Math.max(4, Math.round((cents / max.value) * PLOT)) : 0)

const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })
const longMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthDate = (month: string) => new Date(`${month}-15T12:00:00Z`)
const netFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
/** Net of a month in whole units: "+315", "−165". */
const netLabel = (cents: number) => netFormat.format(Math.round(cents / 100)).replace('-', '−')

const active = ref<string | null>(null)
const activeRow = computed(() => rows.value.find((r) => r.month === active.value))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-4 text-[13px] text-slate-600" aria-hidden="true">
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-indigo-500" /> Entrées</span>
      <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-slate-300" /> Sorties</span>
    </div>

    <div class="relative">
      <!-- Tooltip -->
      <div
        v-if="activeRow"
        class="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-slate-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
        role="status"
      >
        <p class="font-semibold first-letter:uppercase">{{ longMonth.format(monthDate(activeRow.month)) }}</p>
        <p class="tabular-nums">Entrées {{ formatCents(activeRow.credit, currency) }}</p>
        <p class="tabular-nums">Sorties {{ formatCents(activeRow.debit, currency) }}</p>
      </div>

      <ul class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }" aria-hidden="true">
        <li
          v-for="r in rows"
          :key="r.month"
          class="flex flex-col items-center gap-1.5 rounded-xl px-0.5 pt-2 pb-1.5"
          :class="r.month === current ? 'bg-indigo-50' : ''"
          @mouseenter="active = r.month"
          @mouseleave="active = null"
          @touchstart.passive="active = active === r.month ? null : r.month"
        >
          <div class="flex items-end gap-0.5" :style="{ height: `${PLOT}px` }">
            <span class="w-3 rounded-t bg-indigo-500" :style="{ height: `${height(r.credit)}px` }" />
            <span class="w-3 rounded-t bg-slate-300" :style="{ height: `${height(r.debit)}px` }" />
          </div>
          <span class="text-[13px]" :class="r.month === current ? 'font-semibold text-indigo-700' : 'text-slate-600'">
            {{ shortMonth.format(monthDate(r.month)) }}
          </span>
          <span
            class="text-xs font-semibold tabular-nums"
            :class="r.net > 0 ? 'text-emerald-700' : r.net < 0 ? 'text-rose-700' : 'text-slate-500'"
          >
            {{ netLabel(r.net) }}
          </span>
        </li>
      </ul>
    </div>

    <!-- Hidden on a wrapper: a <caption> escapes sr-only set on the table itself -->
    <div class="sr-only">
      <table>
        <caption>Épargne par mois</caption>
        <thead>
          <tr><th scope="col">Mois</th><th scope="col">Entrées</th><th scope="col">Sorties</th><th scope="col">Épargné</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.month">
            <th scope="row">{{ longMonth.format(monthDate(r.month)) }}</th>
            <td>{{ formatCents(r.credit, currency) }}</td>
            <td>{{ formatCents(r.debit, currency) }}</td>
            <td>{{ formatSignedCents(r.net, currency) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
