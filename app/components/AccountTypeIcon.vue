<script setup lang="ts">
// Icon tile for an account type (manual accounts have no bank logo).
import { ChartLine, PiggyBank, Wallet } from 'lucide-vue-next'
import type { AccountType } from '~/types/api'

const props = withDefaults(defineProps<{ type: AccountType; small?: boolean }>(), { small: false })

const look = computed(() => {
  switch (props.type) {
    case 'investment':
      return { icon: ChartLine, classes: 'bg-violet-100 text-violet-700' }
    case 'savings':
      return { icon: PiggyBank, classes: 'bg-teal-100 text-teal-700' }
    default:
      return { icon: Wallet, classes: 'bg-indigo-100 text-indigo-700' }
  }
})
</script>

<template>
  <span
    aria-hidden="true"
    class="flex flex-none items-center justify-center"
    :class="[look.classes, small ? 'size-8 rounded-lg' : 'size-10 rounded-xl']"
  >
    <component :is="look.icon" :class="small ? 'size-4' : 'size-5'" />
  </span>
</template>
