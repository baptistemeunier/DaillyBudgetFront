<script setup lang="ts">
// Bottom sheet to set a manual account's balance on a date (POST _links.balance):
// the API saves the difference as an adjustment transaction.
import { Loader2, X } from 'lucide-vue-next'
import type { Account } from '~/types/api'

const props = defineProps<{
  account: Account
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const update = useUpdateManualBalance()
const error = ref<string | null>(null)

const amount = ref('')
const negative = ref(false)
const date = ref(dayKey(new Date()))
const currency = computed(() => props.account.balanceCurrency ?? 'EUR')

const ids = { title: useId(), amount: useId(), date: useId() }

const cents = computed(() => (amount.value.trim() ? parseAmountInput(amount.value) : 0))
const amountError = computed(() => cents.value === null)
const valid = computed(() => !amountError.value && !!date.value)

const dialog = ref<HTMLDialogElement | null>(null)

// Fresh fields on each opening: the current balance, today.
function reset() {
  const current = props.account.balance != null ? toCents(props.account.balance) : 0
  amount.value = current ? centsToInput(current, true) : ''
  negative.value = current < 0
  date.value = dayKey(new Date())
  error.value = null
}

watch(
  () => props.open,
  (value) => {
    if (!dialog.value) return
    if (value) {
      reset()
      if (!dialog.value.open) dialog.value.showModal()
    } else if (dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)

function close() {
  if (!update.isPending.value) emit('close')
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

async function submit() {
  if (!valid.value || update.isPending.value) return
  error.value = null
  try {
    await update.mutateAsync({
      account: props.account,
      input: {
        balance: centsToDecimal((negative.value ? -1 : 1) * (cents.value ?? 0)),
        balanceAt: date.value,
      },
    })
    emit('close')
  } catch (e) {
    error.value = apiErrorMessage(e, i18nT('errors.saveFailedRetry'))
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="ids.title"
    class="fixed inset-x-0 top-auto bottom-0 mx-auto mb-0 w-full max-w-md rounded-t-3xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 [&:not([open])]:hidden"
    @cancel.prevent="close"
    @close="emit('close')"
    @click="onBackdrop"
  >
    <form
      class="flex flex-col gap-4 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      novalidate
      @submit.prevent="submit"
    >
      <span class="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
      <div class="flex items-center justify-between gap-3">
        <h2 :id="ids.title" class="text-xl font-bold">{{ $t('manualAccount.updateBalance') }}</h2>
        <button
          type="button"
          class="-mr-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-100"
          :aria-label="$t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        <label :for="ids.amount" class="text-[13px] font-medium text-slate-700">{{ $t('manualAccount.newBalance') }}</label>
        <div
          class="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100"
          :class="{ 'border-rose-400': amountError }"
        >
          <button
            type="button"
            class="ml-1 flex size-9 flex-none items-center justify-center rounded-lg text-lg font-semibold text-slate-500 hover:bg-slate-100"
            :aria-label="negative ? $t('manualAccount.makePositive') : $t('manualAccount.makeNegative')"
            :aria-pressed="negative"
            @click="negative = !negative"
          >
            {{ negative ? '−' : '+' }}
          </button>
          <input
            :id="ids.amount"
            v-model="amount"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            :placeholder="$t('common.amountPlaceholder')"
            :aria-invalid="amountError"
            class="min-w-0 flex-1 bg-transparent px-2 text-right text-[17px] font-semibold tabular-nums focus:outline-none"
          />
          <span class="pr-3 text-[15px] text-slate-500">{{ currency }}</span>
        </div>
        <p v-if="amountError" class="text-xs text-rose-700">{{ $t('manualAccount.amountInvalid') }}</p>
        <p v-else class="text-xs text-slate-500">{{ $t('manualAccount.updateBalanceHint') }}</p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label :for="ids.date" class="text-[13px] font-medium text-slate-700">{{ $t('manualAccount.balanceDate') }}</label>
        <input
          :id="ids.date"
          v-model="date"
          type="date"
          required
          :max="dayKey(new Date())"
          class="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-[15px] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

      <button
        type="submit"
        class="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-indigo-600 text-[17px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        :disabled="update.isPending.value || !valid"
      >
        <Loader2 v-if="update.isPending.value" class="size-5 animate-spin" aria-hidden="true" />
        {{ $t('common.save') }}
      </button>
    </form>
  </dialog>
</template>
