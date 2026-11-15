<script setup lang="ts">
// Bank logo from a HAL `bank` link, falling back to the bank's initials.
const props = defineProps<{ href?: string }>()

const { data: bank } = useBankQuery(() => props.href)
const failed = ref(false)
</script>

<template>
  <img
    v-if="bank?.logo && !failed"
    :src="bank.logo"
    alt=""
    class="size-10 flex-none rounded-xl border border-slate-100 object-contain"
    @error="failed = true"
  />
  <span
    v-else
    aria-hidden="true"
    class="flex size-10 flex-none items-center justify-center rounded-xl bg-indigo-100 text-[13px] font-bold text-indigo-700"
  >
    {{ initials(bank?.name ?? $t('common.bank')) }}
  </span>
</template>
