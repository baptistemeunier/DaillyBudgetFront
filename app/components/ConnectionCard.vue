<script setup lang="ts">
import { ChevronDown, ExternalLink } from 'lucide-vue-next'
import type { AccountConnection } from '~/types/api'

const props = defineProps<{ connection: AccountConnection }>()
const open = defineModel<boolean>('open', { default: false })

const { data: bank } = useBankQuery(() => props.connection._links.bank?.href)
const { data: accounts, isPending: accountsPending, isError: accountsError, refetch } = useAccountsQuery(
  () => props.connection._links.accounts?.href,
)

const bankName = computed(() => bank.value?.name ?? 'Banque')
const expired = computed(() => ['EX', 'SU'].includes(props.connection.externalStatus))
const configureHref = computed(() => props.connection._links.configure?.href)
const logoFailed = ref(false)

const subtitle = computed(() => {
  if (accountsPending.value) return 'Chargement…'
  const n = accounts.value?.length ?? 0
  return `${n} compte${n > 1 ? 's' : ''}`
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
        <span>La connexion n'est pas finalisée.</span>
        <a
          :href="configureHref"
          class="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full bg-amber-600 px-4 font-semibold text-white"
        >
          Finaliser <ExternalLink class="size-4" aria-hidden="true" />
        </a>
      </div>

      <p v-if="expired" class="bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
        L'accès bancaire a expiré. Soldes figés au {{ new Date(connection.updatedAt).toLocaleDateString('fr-FR') }}.
      </p>

      <div v-if="accountsPending" class="flex flex-col gap-2 py-3 pr-4 pl-[68px]" aria-hidden="true">
        <div class="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div class="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
      </div>

      <div v-else-if="accountsError" class="flex items-center justify-between gap-3 py-3 pr-4 pl-[68px] text-[13px]">
        <span class="text-rose-800">Impossible de charger les comptes.</span>
        <button type="button" class="min-h-11 font-semibold text-indigo-700" @click="refetch()">Réessayer</button>
      </div>

      <p v-else-if="!accounts?.length" class="py-3 pr-4 pl-[68px] text-[13px] text-slate-500">
        Aucun compte pour cette connexion.
      </p>

      <div v-else class="divide-y divide-slate-100">
        <AccountRow v-for="account in accounts" :key="account._links.self.href" :account="account" :muted="expired" indent />
      </div>
    </div>
  </article>
</template>
