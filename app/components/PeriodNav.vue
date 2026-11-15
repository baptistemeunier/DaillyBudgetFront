<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

defineProps<{ label: string; canGoNext: boolean }>()
defineEmits<{ shift: [direction: -1 | 1] }>()
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <button
      type="button"
      class="flex size-11 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
      :aria-label="$t('period.previous')"
      @click="$emit('shift', -1)"
    >
      <ChevronLeft class="size-5" />
    </button>
    <p class="text-[17px] font-bold" aria-live="polite">{{ label }}</p>
    <button
      type="button"
      class="flex size-11 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
      :aria-label="$t('period.next')"
      :disabled="!canGoNext"
      @click="$emit('shift', 1)"
    >
      <ChevronRight class="size-5" />
    </button>
  </div>
</template>
