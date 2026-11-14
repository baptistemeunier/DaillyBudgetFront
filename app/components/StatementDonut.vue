<script setup lang="ts">
// Part-to-whole ring: one segment per category (2px gap between segments), total in the middle.
// Identity is never color-alone: the named list under the chart is its legend.

import type { DonutSegment } from '~/types/statement'

const props = defineProps<{ segments: DonutSegment[]; total: string; caption: string; ariaLabel: string }>()

const R = 80
const STROKE = 22
const GAP = 2
const C = 2 * Math.PI * R

const arcs = computed(() => {
  const sum = props.segments.reduce((s, seg) => s + Math.max(0, seg.cents), 0)
  if (sum <= 0) return []
  const gap = props.segments.length > 1 ? GAP : 0
  let offset = 0
  return props.segments
    .filter((seg) => seg.cents > 0)
    .map((seg) => {
      const length = (seg.cents / sum) * C
      const arc = { ...seg, dash: `${Math.max(length - gap, 0.5)} ${C}`, offset: -offset }
      offset += length
      return arc
    })
})
</script>

<template>
  <div class="relative mx-auto aspect-square w-full max-w-[240px]">
    <svg viewBox="0 0 200 200" class="size-full -rotate-90" role="img" :aria-label="ariaLabel">
      <circle cx="100" cy="100" :r="R" fill="none" stroke="#f1f5f9" :stroke-width="STROKE" />
      <circle
        v-for="arc in arcs"
        :key="arc.key"
        cx="100"
        cy="100"
        :r="R"
        fill="none"
        :stroke="arc.color"
        :stroke-width="STROKE"
        :stroke-dasharray="arc.dash"
        :stroke-dashoffset="arc.offset"
        class="transition-opacity hover:opacity-80"
      >
        <title>{{ arc.label }} · {{ formatCents(arc.cents) }}</title>
      </circle>
    </svg>
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-[26px] leading-tight font-bold tabular-nums">{{ total }}</span>
      <span class="text-[13px] text-slate-500">{{ caption }}</span>
    </div>
  </div>
</template>
