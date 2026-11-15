<script setup lang="ts">
// Settings of one account: display name (saved on blur / Enter) and type.
import { Check, Loader2 } from 'lucide-vue-next'
import type { Account, AccountType } from '~/types/api'

const props = defineProps<{ account: Account }>()

const update = useUpdateAccount()
const inputId = useId()

const name = ref(props.account.displayName ?? '')
watch(
  () => props.account.displayName,
  (value) => {
    name.value = value ?? ''
  },
)

const saved = ref(false)
async function save(changes: { displayName?: string | null; type?: AccountType }) {
  saved.value = false
  try {
    await update.mutateAsync({ account: props.account, changes })
    saved.value = true
  } catch {
    // update.isError drives the message
  }
}

function saveName() {
  const value = name.value.trim() || null
  if (value === (props.account.displayName ?? null)) return
  save({ displayName: value })
}

const types: AccountType[] = ['checking', 'savings', 'investment']
function setType(type: AccountType) {
  if (type !== props.account.type) save({ type })
}
</script>

<template>
  <article class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
    <p class="truncate text-xs text-slate-500">
      {{ $t('accountSettings.atBank', { name: [account.name, maskIban(account.iban)].filter(Boolean).join(' · ') }) }}
    </p>

    <div class="flex flex-col gap-1.5">
      <label :for="inputId" class="flex items-center justify-between text-[13px] font-medium text-slate-700">
        {{ $t('accountSettings.displayName') }}
        <Loader2 v-if="update.isPending.value" class="size-3.5 animate-spin text-slate-400" aria-hidden="true" />
        <span v-else-if="saved" class="flex items-center gap-1 text-xs font-medium text-emerald-700">
          <Check class="size-3.5" aria-hidden="true" /> {{ $t('common.saved') }}
        </span>
      </label>
      <input
        :id="inputId"
        v-model="name"
        type="text"
        maxlength="255"
        :placeholder="account.name ?? $t('accounts.unnamed')"
        class="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-[15px] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none"
        @blur="saveName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <span class="text-[13px] font-medium text-slate-700">{{ $t('accounts.typeLabel') }}</span>
      <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" :aria-label="$t('accounts.typeLabel')">
        <button
          v-for="type in types"
          :key="type"
          type="button"
          role="radio"
          :aria-checked="account.type === type"
          class="min-h-10 rounded-lg text-[13px] font-medium text-slate-600 aria-checked:bg-white aria-checked:font-semibold aria-checked:text-slate-900 aria-checked:shadow-sm disabled:opacity-60"
          :disabled="update.isPending.value"
          @click="setType(type)"
        >
          {{ accountTypeLabel(type) }}
        </button>
      </div>
      <p class="text-xs text-slate-500">{{ $t('accountSettings.budgetHint') }}</p>
    </div>

    <p v-if="update.isError.value" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
      {{ $t('errors.saveFailedRetry') }}
    </p>
  </article>
</template>
