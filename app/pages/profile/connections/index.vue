<script setup lang="ts">
import { ChevronRight, Plus } from 'lucide-vue-next'

const { data: connections, isPending, isError, refetch } = useConnectionsQuery()
const {
  data: allAccounts,
  isPending: accountsPending,
  isError: accountsError,
  refetch: refetchAccounts,
} = useAllAccountsQuery()
const manualAccounts = computed(() => (allAccounts.value ?? []).filter((a) => a.manual))
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader title="Mes comptes" back="/profile" />

    <section class="flex flex-col gap-2" aria-labelledby="connections-title">
      <h2 id="connections-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Connexions bancaires
      </h2>

      <div v-if="isError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">Impossible de charger vos banques.</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          Réessayer
        </button>
      </div>

      <div v-else class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <template v-if="isPending">
          <div v-for="i in 3" :key="i" class="flex min-h-14 items-center gap-3 px-4 py-3" aria-hidden="true">
            <div class="size-8 animate-pulse rounded-lg bg-slate-100" />
            <div class="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          </div>
        </template>

        <NuxtLink
          v-for="connection in connections"
          :key="connection._links.self.href"
          :to="`/profile/connections/${halId(connection)}`"
          class="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50"
        >
          <BankLogo :href="connection._links.bank?.href" class="size-8! rounded-lg! text-[11px]!" />
          <BankName :href="connection._links.bank?.href" class="min-w-0 flex-1 truncate text-[15px] font-medium" />
          <ConnectionStatusBadge :status="connection.externalStatus" />
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </NuxtLink>

        <NuxtLink to="/banks/new" class="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50">
          <span class="flex size-8 flex-none items-center justify-center rounded-lg bg-indigo-50 text-indigo-700" aria-hidden="true">
            <Plus class="size-5" />
          </span>
          <span class="text-[15px] font-semibold text-indigo-700">Ajouter une banque</span>
        </NuxtLink>
      </div>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="manual-title">
      <h2 id="manual-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Comptes manuels</h2>

      <div v-if="accountsError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">Impossible de charger vos comptes.</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetchAccounts()">
          Réessayer
        </button>
      </div>

      <div v-else class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div v-if="accountsPending" class="flex min-h-14 items-center gap-3 px-4 py-3" aria-hidden="true">
          <div class="size-8 animate-pulse rounded-lg bg-slate-100" />
          <div class="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
        </div>

        <NuxtLink
          v-for="account in manualAccounts"
          :key="account._links.self.href"
          :to="`/profile/manual-accounts/${halId(account)}`"
          class="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50"
        >
          <AccountTypeIcon :type="account.type" small />
          <span class="min-w-0 flex-1 truncate text-[15px] font-medium">{{ accountName(account) }}</span>
          <span class="text-[13px] text-slate-500">{{ ACCOUNT_TYPE_LABELS[account.type] }}</span>
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </NuxtLink>

        <NuxtLink to="/profile/manual-accounts/new" class="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50">
          <span class="flex size-8 flex-none items-center justify-center rounded-lg bg-indigo-50 text-indigo-700" aria-hidden="true">
            <Plus class="size-5" />
          </span>
          <span class="text-[15px] font-semibold text-indigo-700">Ajouter un compte manuel</span>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
