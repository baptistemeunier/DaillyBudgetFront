<script setup lang="ts">
import type { RequisitionStatus } from '~/types/api'

const props = defineProps<{ status: RequisitionStatus }>()

const badge = computed(() => {
  switch (props.status) {
    case 'LN':
      return { label: 'connection.status.linked', classes: 'bg-emerald-100 text-emerald-800' }
    case 'EX':
    case 'SU':
      return { label: 'connection.status.expired', classes: 'bg-rose-100 text-rose-800' }
    default:
      return { label: 'connection.status.actionRequired', classes: 'bg-amber-100 text-amber-800' }
  }
})
</script>

<template>
  <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" :class="badge.classes">
    {{ $t(badge.label) }}
  </span>
</template>
