<script setup lang="ts">
import { ChevronDown, Loader2, X } from 'lucide-vue-next'
import type { AccountType } from '~/types/api'

const router = useRouter()
const create = useCreateManualAccount()

const name = ref('')
const type = ref<Exclude<AccountType, 'checking'>>('savings')
const amount = ref('')
const negative = ref(false)
const currency = ref('EUR')
const date = ref(dayKey(new Date()))

const ids = { name: useId(), amount: useId(), currency: useId(), date: useId() }

const cents = computed(() => (amount.value.trim() ? parseAmountInput(amount.value) : 0))
const nameError = ref(false)
const amountError = computed(() => cents.value === null)
const valid = computed(() => !!name.value.trim() && !amountError.value && !!date.value)

function close() {
  if (window.history.state?.back) router.back()
  else router.push('/profile/connections')
}

async function submit() {
  nameError.value = !name.value.trim()
  if (!valid.value || create.isPending.value) return
  try {
    await create.mutateAsync({
      name: name.value.trim(),
      type: type.value,
      currency: currency.value,
      initialBalance: centsToDecimal((negative.value ? -1 : 1) * (cents.value ?? 0)),
      initialBalanceAt: date.value,
    })
    router.replace('/profile/connections')
  } catch {
    // create.error drives the message
  }
}
</script>

<template>
  <form class="flex min-h-dvh flex-col" novalidate @submit.prevent="submit">
    <main class="flex flex-1 flex-col gap-4 px-4 pt-6 pb-6">
      <PageHeader :title="$t('manualAccount.title')">
        <template #leading>
          <button
            type="button"
            class="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-100"
            :aria-label="$t('common.close')"
            @click="close"
          >
            <X class="size-5" />
          </button>
        </template>
      </PageHeader>

      <p class="text-sm text-slate-600">
        {{ $t('manualAccount.intro') }}
      </p>

      <section class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div class="flex flex-col gap-1.5">
          <label :for="ids.name" class="text-[13px] font-medium text-slate-700">{{ $t('manualAccount.name') }}</label>
          <input
            :id="ids.name"
            v-model="name"
            type="text"
            maxlength="255"
            autocomplete="off"
            :placeholder="$t('manualAccount.namePlaceholder')"
            :aria-invalid="nameError && !name.trim()"
            class="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-[15px] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none aria-invalid:border-rose-400"
          />
          <p v-if="nameError && !name.trim()" class="text-xs text-rose-700">{{ $t('manualAccount.nameRequired') }}</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-[13px] font-medium text-slate-700">{{ $t('accounts.typeLabel') }}</span>
          <ManualAccountTypePicker v-model="type" :disabled="create.isPending.value" />
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-x-3 gap-y-1.5">
            <label :for="ids.amount" class="text-[13px] font-medium text-slate-700">{{ $t('manualAccount.initialBalance') }}</label>
            <label :for="ids.currency" class="text-[13px] font-medium text-slate-700">{{ $t('manualAccount.currency') }}</label>
            <div class="flex min-h-12 items-center rounded-xl border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100" :class="{ 'border-rose-400': amountError }">
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
            </div>
            <div class="relative">
              <select
                :id="ids.currency"
                v-model="currency"
                class="min-h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white pr-8 pl-3 text-[15px] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none"
              >
                <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">{{ c.label }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            </div>
          </div>
          <p v-if="amountError" class="text-xs text-rose-700">{{ $t('manualAccount.amountInvalid') }}</p>
          <p v-else class="text-xs text-slate-500">{{ $t('manualAccount.balanceHint') }}</p>
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
      </section>

      <p v-if="create.isError.value" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
        {{ apiErrorMessage(create.error.value, $t('errors.createFailedRetry')) }}
      </p>
    </main>

    <footer class="sticky bottom-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        type="submit"
        class="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-indigo-600 text-[17px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        :disabled="create.isPending.value"
      >
        <Loader2 v-if="create.isPending.value" class="size-5 animate-spin" aria-hidden="true" />
        {{ $t('manualAccount.create') }}
      </button>
    </footer>
  </form>
</template>
