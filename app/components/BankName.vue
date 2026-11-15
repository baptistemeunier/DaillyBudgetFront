<script setup lang="ts">
// Bank name from a HAL `bank` link.
const props = defineProps<{ href?: string }>()

const { data: bank, isPending } = useBankQuery(() => props.href)
</script>

<template>
  <span v-if="bank">{{ bank.name }}</span>
  <span v-else-if="isPending && href" class="inline-block h-4 w-24 animate-pulse rounded bg-slate-100 align-middle" />
  <span v-else>{{ $t('common.bank') }}</span>
</template>
