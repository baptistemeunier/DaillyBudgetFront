<script setup lang="ts">
import { ChevronRight, Loader2, Pencil, X } from 'lucide-vue-next'
import type { AccountType } from '~/types/api'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))

const { data: account, isPending, isError, refetch } = useAccountQuery(id)
const update = useUpdateAccount()

const name = ref('')
const type = ref<Exclude<AccountType, 'checking'>>('savings')
const nameId = useId()

// Form filled from the account once loaded (and again if it changes elsewhere).
watch(
  account,
  (a) => {
    if (!a) return
    name.value = accountName(a)
    if (a.type !== 'checking') type.value = a.type
  },
  { immediate: true },
)

const changes = computed(() => {
  const a = account.value
  if (!a) return {}
  const out: { displayName?: string | null; type?: AccountType } = {}
  const trimmed = name.value.trim()
  if (trimmed && trimmed !== accountName(a)) out.displayName = trimmed === a.name ? null : trimmed
  if (type.value !== a.type) out.type = type.value
  return out
})
const dirty = computed(() => Object.keys(changes.value).length > 0)
const nameError = computed(() => !name.value.trim())

const balance = computed(() =>
  account.value?.balance != null
    ? formatCents(toCents(account.value.balance), account.value.balanceCurrency ?? 'EUR')
    : null,
)

// New balance on a date (manual account the user may edit: _links.balance).
const balanceOpen = ref(false)

function close() {
  if (window.history.state?.back) router.back()
  else router.push('/profile/connections')
}

async function submit() {
  if (!account.value || nameError.value || update.isPending.value) return
  if (!dirty.value) return close()
  try {
    await update.mutateAsync({ account: account.value, changes: changes.value })
    close()
  } catch {
    // update.error drives the message
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

      <div v-if="isPending" class="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-hidden="true" />

      <div v-else-if="isError || !account" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">{{ $t('errors.loadAccount') }}</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          {{ $t('common.retry') }}
        </button>
      </div>

      <template v-else>
        <section class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex flex-col gap-1.5">
            <label :for="nameId" class="text-[13px] font-medium text-slate-700">{{ $t('manualAccount.name') }}</label>
            <input
              :id="nameId"
              v-model="name"
              type="text"
              maxlength="255"
              autocomplete="off"
              :aria-invalid="nameError"
              class="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-[15px] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none aria-invalid:border-rose-400"
            />
            <p v-if="nameError" class="text-xs text-rose-700">{{ $t('manualAccount.nameRequired') }}</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-[13px] font-medium text-slate-700">{{ $t('accounts.typeLabel') }}</span>
            <ManualAccountTypePicker v-model="type" :disabled="update.isPending.value" />
          </div>
        </section>

        <NuxtLink
          :to="`/accounts/${id}`"
          class="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
        >
          <AccountTypeIcon :type="account.type" />
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-[13px] text-slate-500">
              {{ $t('common.balance') }}<template v-if="account.balanceAt"> · {{ dayLabel(dayKey(account.balanceAt)) }}</template>
            </span>
            <span class="text-[17px] font-bold tabular-nums">{{ balance ?? '—' }}</span>
          </span>
          <span class="text-[13px] font-medium text-indigo-700">{{ $t('manualAccount.history') }}</span>
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </NuxtLink>

        <template v-if="account._links.balance">
          <button
            type="button"
            class="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[15px] font-semibold text-indigo-700 hover:bg-slate-50"
            @click="balanceOpen = true"
          >
            <Pencil class="size-4" aria-hidden="true" />
            {{ $t('manualAccount.updateBalance') }}
          </button>
          <BalanceSheet :account="account" :open="balanceOpen" @close="balanceOpen = false" />
        </template>
      </template>

      <p v-if="update.isError.value" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
        {{ apiErrorMessage(update.error.value, $t('errors.saveFailedRetry')) }}
      </p>
    </main>

    <footer
      v-if="account"
      class="sticky bottom-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <button
        type="submit"
        class="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-indigo-600 text-[17px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        :disabled="update.isPending.value || nameError"
      >
        <Loader2 v-if="update.isPending.value" class="size-5 animate-spin" aria-hidden="true" />
        {{ $t('common.save') }}
      </button>
    </footer>
  </form>
</template>
