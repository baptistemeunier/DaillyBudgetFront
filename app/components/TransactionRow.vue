<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { Transaction } from '~/types/api'

const props = defineProps<{
  transaction: Transaction
  /** Selection mode: a check circle replaces the emoji and the row toggles. */
  selectable?: boolean
  selected?: boolean
  /** Subtitle = "Account · Bank", followed by the category unless there is none. */
  showAccount?: boolean
}>()
defineEmits<{ select: [] }>()

const { data: tree } = useCategoriesQuery()
const row = computed(() => transactionRowCategory(props.transaction, tree.value))
const hasCategory = computed(() => categorizationStatus(props.transaction, tree.value).kind !== 'none')
const cents = computed(() => toCents(props.transaction.amount))

// Account label (only when asked): the account list is cached, banks too.
const { data: accounts } = useAllAccountsQuery()
const accountHref = computed(() =>
  props.showAccount ? (props.transaction._links.account?.href ?? null) : null,
)
const account = computed(() =>
  accountHref.value ? accounts.value?.find((a) => a._links.self.href === accountHref.value) : undefined,
)
const { data: bank } = useBankQuery(() => account.value?._links.bank?.href)
const accountLabel = computed(() =>
  account.value ? [accountName(account.value), bank.value?.name].filter(Boolean).join(' · ') : '',
)
</script>

<template>
  <button
    type="button"
    class="flex min-h-16 w-full items-center gap-3 px-3.5 py-2.5 text-left"
    :class="selectable && selected ? 'bg-indigo-50' : 'hover:bg-slate-50'"
    :role="selectable ? 'checkbox' : undefined"
    :aria-checked="selectable ? !!selected : undefined"
    :aria-haspopup="selectable ? undefined : 'dialog'"
    @click="$emit('select')"
  >
    <span
      v-if="selectable"
      aria-hidden="true"
      class="flex size-10 flex-none items-center justify-center"
    >
      <span
        class="flex size-6 items-center justify-center rounded-full border-2"
        :class="selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'"
      >
        <Check v-if="selected" class="size-4" />
      </span>
    </span>
    <span
      v-else
      aria-hidden="true"
      class="flex size-10 flex-none items-center justify-center rounded-full text-lg"
      :class="row.uncategorized ? 'bg-amber-50' : 'bg-slate-100'"
    >
      {{ row.emoji }}
    </span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate text-[15px] font-medium">{{ transaction.description }}</span>
      <span v-if="showAccount" class="truncate text-[13px] text-slate-500">
        {{ accountLabel }}
        <template v-if="hasCategory">
          · <span :class="row.uncategorized ? 'text-amber-700' : ''">{{ row.label }}</span>
        </template>
      </span>
      <span v-else class="truncate text-[13px]" :class="row.uncategorized ? 'text-amber-700' : 'text-slate-500'">
        {{ row.label }}
      </span>
    </span>
    <span class="flex-none text-[15px] font-semibold tabular-nums" :class="cents > 0 ? 'text-emerald-700' : 'text-slate-900'">
      {{ formatSignedCents(cents, transaction.currency) }}
    </span>
  </button>
</template>
