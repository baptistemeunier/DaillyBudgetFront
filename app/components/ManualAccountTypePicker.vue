<script setup lang="ts">
// Savings / investment segmented control (a manual account can't be a checking account).
import type { AccountType } from '~/types/api'

defineProps<{ disabled?: boolean }>()
const model = defineModel<Exclude<AccountType, 'checking'>>({ required: true })

const types = ['savings', 'investment'] as const
</script>

<template>
  <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" :aria-label="$t('accounts.typeLabel')">
    <button
      v-for="type in types"
      :key="type"
      type="button"
      role="radio"
      :aria-checked="model === type"
      class="min-h-11 rounded-lg text-[15px] font-medium text-slate-600 aria-checked:bg-white aria-checked:font-semibold aria-checked:text-slate-900 aria-checked:shadow-sm disabled:opacity-60"
      :disabled="disabled"
      @click="model = type"
    >
      {{ accountTypeLabel(type) }}
    </button>
  </div>
</template>
