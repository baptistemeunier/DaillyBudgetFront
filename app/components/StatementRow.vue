<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

import { NuxtLink } from '#components'
import type { StatementRowView } from '~/types/statement'

const props = defineProps<{
  row: StatementRowView
  /** Bar = share of the parent total (category color), instead of spending vs target. */
  share?: boolean
}>()

// Spending outside the budget (percent set, no target) counts as fully over budget: full red bar.
const ratio = computed(() => {
  if (props.row.targetCents) return props.row.cents / props.row.targetCents
  return props.row.percent !== null ? Infinity : 0
})
const bar = computed(() => budgetStatusColor(ratio.value))
</script>

<template>
  <component
    :is="row.to ? NuxtLink : 'div'"
    :to="row.to"
    class="flex min-h-[72px] items-center gap-3 py-3"
    :class="row.to ? '-mx-2 rounded-xl px-2 hover:bg-slate-50' : ''"
  >
    <span
      aria-hidden="true"
      class="flex size-11 flex-none items-center justify-center rounded-full text-lg"
      :style="{ backgroundColor: `${row.color}26` }"
    >
      <component :is="row.icon" class="size-5" :style="{ color: row.color }" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="flex items-center gap-1.5">
        <span class="size-2 flex-none rounded-full" :style="{ backgroundColor: row.color }" aria-hidden="true" />
        <span class="truncate text-[15px] font-semibold">{{ row.label }}</span>
      </span>
      <span class="text-[13px] text-slate-500">
        <template v-if="row.percent !== null">
          <span v-if="!share" class="font-semibold" :class="budgetStatusText(ratio)">
            {{ row.percent }} %
          </span>
          <template v-else>{{ row.percent }} %</template>
          ·
        </template>
        {{ row.count }} transaction{{ row.count > 1 ? 's' : '' }}
      </span>
      <span v-if="share" class="block h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span class="block h-full rounded-full" :style="{ width: `${Math.min(100, row.percent ?? 0)}%`, backgroundColor: row.color }" />
      </span>
      <span v-else-if="row.targetCents || row.percent !== null" class="block h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <span class="block h-full rounded-full" :class="bar" :style="{ width: `${Math.min(100, ratio * 100)}%` }" />
      </span>
    </span>
    <span class="flex flex-none flex-col items-end">
      <span class="text-[15px] font-bold tabular-nums">{{ formatCents(row.cents, row.currency) }}</span>
      <span v-if="row.targetCents" class="text-[13px] text-slate-500 tabular-nums">
        sur {{ formatCents(row.targetCents, row.currency) }}
      </span>
    </span>
    <ChevronRight v-if="row.to" class="size-5 flex-none text-slate-400" aria-hidden="true" />
  </component>
</template>
