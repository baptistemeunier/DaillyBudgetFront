<script setup lang="ts">
// One saving envelope: amount saved, change this month, progress towards its target.
import type { Component } from 'vue'
import type { SavingEnvelope } from '~/types/api'

const props = defineProps<{
  envelope: SavingEnvelope
  name: string
  iri: string
  icon: Component
  currency: string
  editable?: boolean
}>()
defineEmits<{ edit: [] }>()

const amount = computed(() => toCents(props.envelope.amount))
const change = computed(() => toCents(props.envelope.periodAmount))
const target = computed(() => (props.envelope.targetAmount ? toCents(props.envelope.targetAmount) : 0))
const progress = computed(() => (target.value > 0 ? Math.min(100, Math.max(0, Math.round((amount.value / target.value) * 100))) : null))

const color = computed(() => envelopeColor(props.iri))

const targetMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const goal = computed(() => {
  if (!target.value) return null
  const date = props.envelope.targetDate ? targetMonth.format(new Date(`${props.envelope.targetDate.slice(0, 10)}T12:00:00Z`)) : null
  return [`Objectif ${formatCentsShort(target.value, props.currency)}`, date].filter(Boolean).join(' · ')
})
</script>

<template>
  <component
    :is="editable ? 'button' : 'article'"
    :type="editable ? 'button' : undefined"
    class="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left"
    :class="editable ? 'hover:border-indigo-200 hover:bg-slate-50' : ''"
    @click="editable && $emit('edit')"
  >
    <span class="flex items-start gap-3">
      <span class="flex size-11 flex-none items-center justify-center rounded-xl" :class="color.tile" aria-hidden="true">
        <component :is="icon" class="size-5" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-[15px] leading-snug font-semibold">{{ name }}</span>
        <span v-if="goal" class="text-[13px] text-slate-500">{{ goal }}</span>
      </span>
      <span class="flex flex-none flex-col items-end gap-0.5">
        <span class="text-[15px] font-bold tabular-nums">{{ formatCents(amount, currency) }}</span>
        <span
          v-if="change !== 0"
          class="text-xs font-semibold tabular-nums"
          :class="change > 0 ? 'text-emerald-700' : 'text-rose-700'"
        >
          {{ formatSignedCents(change, currency) }} ce mois
        </span>
      </span>
    </span>

    <span v-if="progress !== null" class="flex items-center gap-3">
      <span
        class="block h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${name} : ${progress} % de l'objectif`"
      >
        <span class="block h-full rounded-full" :class="color.bar" :style="{ width: `${progress}%` }" />
      </span>
      <span class="w-10 flex-none text-right text-xs font-medium text-slate-600 tabular-nums">{{ progress }} %</span>
    </span>
  </component>
</template>
