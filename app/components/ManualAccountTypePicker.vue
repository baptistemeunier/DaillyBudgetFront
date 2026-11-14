<script setup lang="ts">
// Savings / investment segmented control (a manual account can't be a checking account).
import type { AccountType } from '~/types/api'

defineProps<{ disabled?: boolean }>()
const model = defineModel<Exclude<AccountType, 'checking'>>({ required: true })

const types = [
  { value: 'savings', label: 'Épargne' },
  { value: 'investment', label: 'Investissement' },
] as const
</script>

<template>
  <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Type de compte">
    <button
      v-for="t in types"
      :key="t.value"
      type="button"
      role="radio"
      :aria-checked="model === t.value"
      class="min-h-11 rounded-lg text-[15px] font-medium text-slate-600 aria-checked:bg-white aria-checked:font-semibold aria-checked:text-slate-900 aria-checked:shadow-sm disabled:opacity-60"
      :disabled="disabled"
      @click="model = t.value"
    >
      {{ t.label }}
    </button>
  </div>
</template>
