<script setup lang="ts">
// A connection that was just linked (GoCardless callback, after PATCH /sync):
// its accounts and their first synchronization, until each one ends in success or failure.
import { Check, Loader2, X } from 'lucide-vue-next'

const props = defineProps<{ connectionId: string }>()
const { t } = useI18n()

const { data: connections, refetch: refetchConnections } = useConnectionsQuery()
const connection = computed(() => connections.value?.find((c) => halId(c) === props.connectionId))

// useAccountsQuery polls every 3 s while an account is PENDING / IN_PROGRESS.
const { data: accounts, isPending: accountsPending, refetch: refetchAccounts } = useAccountsQuery(
  () => connection.value?._links.accounts?.href,
)

// The connection list may predate the link (accounts just discovered): reload it once.
onMounted(() => refetchConnections())

// No account yet (discovery in progress): ask again every 3 s for 30 s.
const now = useNow()
const startedAt = Date.now()
const discovering = computed(() => !accounts.value?.length && now.value - startedAt < 30_000)
let discoverTimer: ReturnType<typeof setInterval> | undefined
watch(
  discovering,
  (on) => {
    clearInterval(discoverTimer)
    if (on) discoverTimer = setInterval(() => (accounts.value ? refetchAccounts() : refetchConnections()), 3000)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(discoverTimer))

const isSyncing = (s: string | null) => s === 'PENDING' || s === 'IN_PROGRESS'
const doneCount = computed(() => (accounts.value ?? []).filter((a) => !isSyncing(a.synchronizedStatus)).length)
const failedCount = computed(() => (accounts.value ?? []).filter((a) => a.synchronizedStatus === 'FAILED').length)
const allDone = computed(() => !!accounts.value?.length && doneCount.value === accounts.value.length)
const syncSummary = computed(() => {
  const total = accounts.value?.length ?? 0
  if (!total) return t('bankConfigure.discovering')
  if (!allDone.value) return t('bankConfigure.syncProgress', { done: doneCount.value, total })
  return failedCount.value ? t('bankConfigure.syncFailed', failedCount.value) : t('bankConfigure.syncDone')
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
      <span class="flex size-9 flex-none items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
        <Check class="size-5" />
      </span>
      <div class="flex min-w-0 flex-col">
        <p class="text-[15px] font-semibold text-emerald-900">{{ $t('bankConfigure.success') }}</p>
        <p class="text-[13px] text-emerald-800" aria-live="polite">{{ syncSummary }}</p>
      </div>
    </div>

    <ul
      v-if="accounts?.length"
      class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white"
      aria-live="polite"
    >
      <li v-for="account in accounts" :key="account._links.self.href" class="flex min-h-16 items-center gap-3 px-4 py-2.5">
        <AccountTypeIcon :type="account.type" small />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-[15px] font-medium">{{ accountName(account) }}</span>
          <span class="text-[13px]" :class="account.synchronizedStatus === 'FAILED' ? 'text-rose-700' : 'text-slate-500'">
            <template v-if="isSyncing(account.synchronizedStatus)">{{ $t('accounts.syncing') }}</template>
            <template v-else-if="account.synchronizedStatus === 'FAILED'">{{ $t('accounts.syncFailed') }}</template>
            <template v-else>{{ $t('bankConfigure.accountSynced') }}</template>
          </span>
        </span>
        <Loader2
          v-if="isSyncing(account.synchronizedStatus)"
          class="size-5 flex-none animate-spin text-indigo-600"
          :aria-label="$t('accounts.syncing')"
        />
        <span
          v-else-if="account.synchronizedStatus === 'FAILED'"
          class="flex size-6 flex-none items-center justify-center rounded-full bg-rose-100 text-rose-700"
          :aria-label="$t('accounts.syncFailed')"
        >
          <X class="size-4" />
        </span>
        <span
          v-else
          class="flex size-6 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
          :aria-label="$t('bankConfigure.accountSynced')"
        >
          <Check class="size-4" />
        </span>
      </li>
    </ul>

    <div v-else-if="discovering || accountsPending" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-2xl bg-white" />
    </div>

    <p v-else class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
      {{ $t('bankConfigure.noAccount') }}
    </p>

    <NuxtLink
      to="/"
      class="inline-flex min-h-12 items-center justify-center rounded-full text-[15px] font-semibold"
      :class="allDone || (!discovering && !accounts?.length) ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-700'"
    >
      {{ $t('bankConfigure.goHome') }}
    </NuxtLink>
  </section>
</template>
