<script setup lang="ts">
import { CircleUserRound, Plus, RefreshCw } from 'lucide-vue-next'

definePageMeta({ tabs: true })

const { t } = useI18n()
const { data: connections, isPending, isError, refetch } = useConnectionsQuery()
const { data: allAccounts } = useAllAccountsQuery()

// Refresh button: sync every linked connection.
const sync = useSyncConnection()
const syncingAll = ref(false)
async function syncAll() {
  if (syncingAll.value || !connections.value) return
  syncingAll.value = true
  try {
    await Promise.allSettled(
      connections.value.filter((c) => c.externalStatus === 'LN').map((c) => sync.mutateAsync(halId(c))),
    )
  } finally {
    syncingAll.value = false
  }
}

// Accounts not shown in any connection card: no connection at all, or a
// connection that was (soft-)deleted and is no longer listed.
const orphans = computed(() => {
  if (!connections.value || !allAccounts.value) return []
  const listed = new Set(connections.value.map(halId))
  return allAccounts.value
    .map((account) => {
      const href = account._links['account-connection']?.href
      const connectionId = href ? halId({ _links: { self: { href } } }) : null
      if (connectionId && listed.has(connectionId)) return null
      const note = account.manual
        ? accountTypeLabel(account.type)
        : connectionId
          ? t('home.connectionDeleted')
          : t('home.noConnection')
      return { account, note }
    })
    .filter((o) => o !== null)
})

// Accordion state, remembered across navigation (per viewer).
const OPEN_KEY = 'home.openConnections'
const openState = ref<Record<string, boolean>>({})
try {
  openState.value = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}')
} catch {
  // storage unavailable: defaults only
}
watch(
  openState,
  (v) => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(v))
    } catch {
      // ignore
    }
  },
  { deep: true },
)

// First connection open by default (unless the user already chose).
const isOpen = (id: string, index: number) => openState.value[id] ?? index === 0
const setOpen = (id: string, value: boolean) => {
  openState.value = { ...openState.value, [id]: value }
}
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-24">
    <PageHeader :title="$t('home.title')">
      <template #leading>
        <NuxtLink
          to="/profile"
          class="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-100"
          :aria-label="$t('profile.title')"
        >
          <CircleUserRound class="size-6" />
        </NuxtLink>
      </template>
      <template #trailing>
        <NotificationBell />
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
          :aria-label="$t('home.syncAll')"
          :disabled="syncingAll || !connections?.length"
          @click="syncAll"
        >
          <RefreshCw class="size-5" :class="{ 'animate-spin': syncingAll }" />
        </button>
      </template>
    </PageHeader>

    <PushPromptCard />

    <TodoCarousel />

    <section class="flex flex-col gap-3" aria-labelledby="banks-title">
      <h2 id="banks-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {{ $t('home.connectedBanks') }}
      </h2>

      <template v-if="isPending">
        <div v-for="i in 3" :key="i" class="h-[72px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </template>

      <div v-else-if="isError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">{{ $t('errors.loadYourBanks') }}</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          {{ $t('common.retry') }}
        </button>
      </div>

      <p v-else-if="!connections?.length" class="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
        {{ $t('home.noBank') }}
      </p>

      <template v-else>
        <ConnectionCard
          v-for="(connection, index) in connections"
          :key="connection._links.self.href"
          :connection="connection"
          :open="isOpen(halId(connection), index)"
          @update:open="setOpen(halId(connection), $event)"
        />
      </template>

      <NuxtLink
        to="/banks/new"
        class="flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 text-[15px] font-semibold text-indigo-700"
      >
        <Plus class="size-5" aria-hidden="true" /> {{ $t('banks.add') }}
      </NuxtLink>
    </section>

    <section v-if="orphans.length" class="flex flex-col gap-3" aria-labelledby="other-accounts-title">
      <h2 id="other-accounts-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {{ $t('home.otherAccounts') }}
      </h2>
      <div class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <AccountRow
          v-for="{ account, note } in orphans"
          :key="account._links.self.href"
          :account="account"
          :note="note"
          :muted="!account.manual"
        >
          <template #leading>
            <AccountTypeIcon v-if="account.manual" :type="account.type" />
            <BankLogo v-else :href="account._links.bank?.href" />
          </template>
        </AccountRow>
      </div>
    </section>
  </main>
</template>
