<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import type { Account } from '~/types/api'

const props = defineProps<{
  account: Account
  /** Greyed balance (expired connection). */
  muted?: boolean
  /** Align with the bank name inside a ConnectionCard (logo column). */
  indent?: boolean
  /** Extra info after the IBAN, e.g. "Connexion supprimée". */
  note?: string
}>()

const syncing = computed(
  () => props.account.synchronizedStatus === 'PENDING' || props.account.synchronizedStatus === 'IN_PROGRESS',
)

const balance = computed(() =>
  props.account.balanceAmount != null
    ? formatCents(toCents(props.account.balanceAmount), props.account.balanceCurrency ?? 'EUR')
    : null,
)
</script>

<template>
  <NuxtLink
    :to="`/accounts/${halId(account)}`"
    class="flex min-h-16 items-center gap-3 py-3 pr-4 hover:bg-slate-50"
    :class="indent ? 'pl-[68px]' : 'pl-4'"
  >
    <slot name="leading" />
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate text-[15px] font-medium">{{ accountName(account) }}</span>
      <span class="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
        {{ maskIban(account.iban) }}
        <span v-if="note">· {{ note }}</span>
        <span v-if="syncing" class="font-medium text-indigo-700">· Synchro…</span>
        <span v-else-if="account.synchronizedStatus === 'FAILED'" class="font-medium text-rose-700">· Échec synchro</span>
      </span>
    </span>
    <span v-if="balance" class="text-[15px] font-semibold tabular-nums" :class="muted ? 'text-slate-500' : 'text-slate-900'">
      {{ balance }}
    </span>
    <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
  </NuxtLink>
</template>
