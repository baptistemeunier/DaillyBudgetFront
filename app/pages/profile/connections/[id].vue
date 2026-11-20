<script setup lang="ts">
import { ExternalLink, Loader2, RefreshCw } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = computed(() => String(route.params.id))

const { data: connections, isPending: connectionsPending, isError: connectionsError, refetch } = useConnectionsQuery()
const connection = computed(() => connections.value?.find((c) => halId(c) === id.value))

const { data: bank } = useBankQuery(() => connection.value?._links.bank?.href)
const bankName = computed(() => bank.value?.name ?? t('common.bank'))

const {
  data: accounts,
  isPending: accountsPending,
  isError: accountsError,
  refetch: refetchAccounts,
} = useAccountsQuery(() => connection.value?._links.accounts?.href)

const linked = computed(() => connection.value?.externalStatus === 'LN')
const expired = computed(() => ['EX', 'SU'].includes(connection.value?.externalStatus ?? ''))
const configureHref = computed(() => connection.value?._links.configure?.href)
// Connections are shared: only their owner (the user who gave the bank consent) gets the action links
// (_links.sync, _links.delete) and can sync, reconnect or delete it.
const owned = computed(() => !!connection.value?._links.delete)
const canSync = computed(() => linked.value && !!connection.value?._links.sync)

// Synchronisation
const sync = useSyncConnection()
const syncing = computed(
  () =>
    sync.isPending.value ||
    !!accounts.value?.some((a) => a.synchronizedStatus === 'PENDING' || a.synchronizedStatus === 'IN_PROGRESS'),
)
const lastSync = computed(() => {
  const dates = (accounts.value ?? []).map((a) => a.synchronizedAt).filter((d): d is string => !!d)
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
})
const syncFailed = computed(() => !!accounts.value?.some((a) => a.synchronizedStatus === 'FAILED'))
function startSync() {
  if (!syncing.value) sync.mutate(id.value)
}

// Expired access can't be renewed: start a new connection to the same bank.
const reconnect = useReconnectBank()
function startReconnect() {
  if (bank.value) reconnect.start(bank.value.id)
}

// Deletion. Only "keep the accounts" exists for now (they move to "Other accounts" on the home page).
const remove = useDeleteConnection()
const removeOpen = ref(false)
function startRemove() {
  if (remove.isPending.value) return
  remove.reset()
  removeOpen.value = true
}
async function confirmRemove() {
  if (!connection.value || remove.isPending.value) return
  try {
    await remove.mutateAsync(connection.value)
    removeOpen.value = false
    router.replace('/profile/connections')
  } catch {
    // remove.isError drives the message in the dialog
  }
}

</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader back="/profile/connections">
      <span v-if="bank">{{ bank.name }}</span>
      <span v-else-if="connection || connectionsPending" class="inline-block h-6 w-32 animate-pulse rounded bg-slate-100 align-middle" />
      <span v-else>{{ $t('common.bank') }}</span>
    </PageHeader>

    <div v-if="connectionsError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
      <span class="text-sm text-rose-800">{{ $t('errors.loadBank') }}</span>
      <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
        {{ $t('common.retry') }}
      </button>
    </div>

    <p v-else-if="!connectionsPending && !connection" class="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
      {{ $t('connection.gone') }}
    </p>

    <template v-else-if="connection">
      <div
        v-if="configureHref && !linked && !expired"
        class="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
      >
        <span>{{ $t('connection.notFinalized') }}</span>
        <a :href="configureHref" class="inline-flex h-8 flex-none items-center gap-1 rounded-full bg-amber-600 px-3 text-xs font-semibold text-white">
          {{ $t('common.finalize') }} <ExternalLink class="size-3.5" aria-hidden="true" />
        </a>
      </div>

      <div v-if="expired" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
        <span>
          {{ $t('connection.expired') }}
          <span v-if="reconnect.isError.value" class="block font-semibold">{{ $t('errors.reconnectFailed') }}</span>
        </span>
        <button
          v-if="owned"
          type="button"
          class="inline-flex h-8 flex-none items-center gap-1 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="!bank || reconnect.isPending.value"
          @click="startReconnect"
        >
          {{ $t('common.reconnect') }}
          <Loader2 v-if="reconnect.isPending.value" class="size-3.5 animate-spin" aria-hidden="true" />
          <ExternalLink v-else class="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <section class="flex flex-col gap-2" aria-labelledby="accounts-title">
        <h2 id="accounts-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">{{ $t('connection.accounts') }}</h2>

        <div v-if="accountsPending" class="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-hidden="true" />

        <div v-else-if="accountsError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
          <span class="text-sm text-rose-800">{{ $t('errors.loadAccounts') }}</span>
          <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetchAccounts()">{{ $t('common.retry') }}</button>
        </div>

        <p v-else-if="!accounts?.length" class="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
          {{ $t('connection.noAccounts') }}
        </p>

        <AccountSettingsCard v-for="account in accounts" v-else :key="account._links.self.href" :account="account" />
      </section>

      <section v-if="canSync" class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="sync-title">
        <h2 id="sync-title" class="text-[15px] font-semibold">{{ $t('sync.title') }}</h2>
        <p class="text-[13px] text-slate-600">
          <template v-if="syncing">{{ $t('sync.inProgress') }}</template>
          <template v-else-if="lastSync">
            {{ $t(syncFailed ? 'sync.lastFailedAgo' : 'sync.syncedAgo', { when: relativeTime(lastSync) }) }}.
          </template>
          {{ $t('sync.delayHint') }}
        </p>
        <p v-if="sync.isError.value" class="text-[13px] font-semibold text-rose-800" role="alert">{{ $t('errors.syncFailedRetry') }}</p>
        <button
          type="button"
          class="mt-1 inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 disabled:opacity-60"
          :disabled="syncing"
          @click="startSync"
        >
          <RefreshCw class="size-4" :class="{ 'animate-spin': syncing }" aria-hidden="true" />
          {{ $t('sync.now') }}
        </button>
      </section>

      <p v-if="!owned" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-600">
        {{ $t('connection.sharedByOther') }}
      </p>

      <section v-if="owned" class="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-white p-4" aria-labelledby="delete-title">
        <h2 id="delete-title" class="text-[15px] font-semibold text-rose-700">{{ $t('connection.deleteTitle') }}</h2>
        <p class="text-[13px] text-slate-600">
          {{ $t('connection.deleteHint', { bank: bankName }) }}
        </p>
        <button
          type="button"
          class="mt-1 inline-flex min-h-11 items-center self-start rounded-full border border-rose-300 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          @click="startRemove"
        >
          {{ $t('connection.deleteBank', { bank: bankName }) }}
        </button>
      </section>

      <DeleteConnectionSheet
        v-model:open="removeOpen"
        :bank-name="bankName"
        :account-names="(accounts ?? []).map(accountName)"
        :pending="remove.isPending.value"
        :error="remove.isError.value ? $t('errors.deleteFailedRetry') : null"
        @confirm="confirmRemove"
      />
    </template>
  </main>
</template>
