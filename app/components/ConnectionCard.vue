<script setup lang="ts">
import { ChevronDown, ExternalLink, Loader2, Trash2 } from 'lucide-vue-next'
import type { AccountConnection } from '~/types/api'

const props = defineProps<{ connection: AccountConnection }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const { data: bank } = useBankQuery(() => props.connection._links.bank?.href)
const { data: accounts, isPending: accountsPending, isError: accountsError, refetch } = useAccountsQuery(
  () => props.connection._links.accounts?.href,
)

const bankName = computed(() => bank.value?.name ?? t('common.bank'))
const expired = computed(() => ['EX', 'SU'].includes(props.connection.externalStatus))
const configureHref = computed(() => props.connection._links.configure?.href)
// Connections are shared: only their owner (the user who gave the bank consent) gets _links.delete,
// and only they can reconnect or delete it.
const owned = computed(() => !!props.connection._links.delete)
const logoFailed = ref(false)

// Expired access can't be renewed: start a new connection to the same bank.
const reconnect = useReconnectBank()
function startReconnect() {
  if (bank.value) reconnect.start(bank.value.id)
}

// A linked or expired connection without any account is useless: offer to remove it.
const removable = computed(
  () =>
    owned.value &&
    ['LN', 'EX'].includes(props.connection.externalStatus) &&
    !accountsPending.value &&
    !accounts.value?.length,
)
const remove = useDeleteConnection()
const removeOpen = ref(false)
function startRemove() {
  if (remove.isPending.value) return
  remove.reset()
  removeOpen.value = true
}
async function confirmRemove() {
  if (remove.isPending.value) return
  try {
    await remove.mutateAsync(props.connection)
    removeOpen.value = false
  } catch {
    // remove.isError drives the message in the dialog
  }
}

const subtitle = computed(() => {
  if (accountsPending.value) return t('common.loading')
  return t('common.accountCount', accounts.value?.length ?? 0)
})

const panelId = computed(() => `connection-${halId(props.connection)}`)
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <button
      type="button"
      :aria-expanded="open"
      :aria-controls="panelId"
      class="flex min-h-[72px] w-full items-center gap-3 px-4 py-3.5 text-left"
      @click="open = !open"
    >
      <img
        v-if="bank?.logo && !logoFailed"
        :src="bank.logo"
        alt=""
        class="size-10 flex-none rounded-xl border border-slate-100 object-contain"
        @error="logoFailed = true"
      />
      <span
        v-else
        aria-hidden="true"
        class="flex size-10 flex-none items-center justify-center rounded-xl bg-indigo-100 text-[13px] font-bold text-indigo-700"
      >
        {{ initials(bankName) }}
      </span>

      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="flex items-center gap-2">
          <span class="truncate text-[15px] font-semibold">{{ bankName }}</span>
          <ConnectionStatusBadge :status="connection.externalStatus" />
        </span>
        <span class="text-[13px] text-slate-500">{{ subtitle }}</span>
      </span>

      <ChevronDown
        class="size-5 flex-none text-slate-500 transition-transform"
        :class="{ 'rotate-180': open }"
        aria-hidden="true"
      />
    </button>

    <div v-show="open" :id="panelId" class="flex flex-col border-t border-slate-100">
      <div
        v-if="configureHref"
        class="flex items-center justify-between gap-3 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
      >
        <span>{{ $t('connection.notFinalized') }}</span>
        <a
          :href="configureHref"
          class="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-amber-600 px-2.5 text-xs font-semibold text-white"
        >
          {{ $t('common.finalize') }} <ExternalLink class="size-3.5" aria-hidden="true" />
        </a>
      </div>

      <div v-if="expired" class="flex items-center justify-between gap-3 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
        <span>
          {{ $t('connection.expiredFrozen', { date: formatDate(connection.updatedAt) }) }}
          <span v-if="reconnect.isError.value" class="block font-semibold">{{ $t('errors.reconnectFailed') }}</span>
        </span>
        <button
          v-if="owned"
          type="button"
          class="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-rose-600 px-2.5 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="!bank || reconnect.isPending.value"
          @click="startReconnect"
        >
          {{ $t('common.reconnect') }}
          <Loader2 v-if="reconnect.isPending.value" class="size-3.5 animate-spin" aria-hidden="true" />
          <ExternalLink v-else class="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div v-if="accountsPending" class="flex flex-col gap-2 py-3 pr-4 pl-[68px]" aria-hidden="true">
        <div class="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div class="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
      </div>

      <div v-else-if="accountsError" class="flex items-center justify-between gap-3 py-3 pr-4 pl-[68px] text-[13px]">
        <span class="text-rose-800">{{ $t('errors.loadAccounts') }}</span>
        <button type="button" class="min-h-11 font-semibold text-indigo-700" @click="refetch()">{{ $t('common.retry') }}</button>
      </div>

      <div v-else-if="!accounts?.length" class="flex items-center justify-between gap-3 py-3 pr-4 pl-[68px] text-[13px]">
        <span class="text-slate-500">
          {{ $t('connection.noAccounts') }}
          <span v-if="remove.isError.value" class="block font-semibold text-rose-800">{{ $t('errors.deleteFailedRetry') }}</span>
        </span>
        <button
          v-if="removable"
          type="button"
          class="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-slate-700 px-2.5 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="remove.isPending.value"
          @click="startRemove"
        >
          {{ $t('common.delete') }}
          <Loader2 v-if="remove.isPending.value" class="size-3.5 animate-spin" aria-hidden="true" />
          <Trash2 v-else class="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <AccountRow v-for="account in accounts" :key="account._links.self.href" :account="account" :muted="expired" indent />
      </div>
    </div>

    <ConfirmDialog
      v-model:open="removeOpen"
      :title="$t('connection.removeTitle', { bank: bankName })"
      :confirm-label="$t('common.delete')"
      tone="danger"
      :icon="Trash2"
      :pending="remove.isPending.value"
      :error="remove.isError.value ? $t('errors.deleteFailedRetry') : null"
      @confirm="confirmRemove"
    >
      <p>{{ $t('connection.removeEmpty') }}</p>
    </ConfirmDialog>
  </article>
</template>
