<script setup lang="ts">
import { ChevronDown, ExternalLink, Loader2, Trash2 } from 'lucide-vue-next'
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

// Expired access can't be renewed: start a new connection to the same bank.
const reconnect = useReconnectBank()
function startReconnect() {
  if (bank.value) reconnect.start(bank.value.id)
}

// A linked or expired connection without any account is useless: offer to remove it.
const removable = computed(
  () => ['LN', 'EX'].includes(props.connection.externalStatus) && !accountsPending.value && !accounts.value?.length,
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
          class="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-amber-600 px-2.5 text-xs font-semibold text-white"
        >
          Finaliser <ExternalLink class="size-3.5" aria-hidden="true" />
        </a>
      </div>

      <div v-if="expired" class="flex items-center justify-between gap-3 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
        <span>
          L'accès bancaire a expiré. Soldes figés au {{ new Date(connection.updatedAt).toLocaleDateString('fr-FR') }}.
          <span v-if="reconnect.isError.value" class="block font-semibold">La reconnexion a échoué, réessayez.</span>
        </span>
        <button
          type="button"
          class="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-rose-600 px-2.5 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="!bank || reconnect.isPending.value"
          @click="startReconnect"
        >
          Reconnecter
          <Loader2 v-if="reconnect.isPending.value" class="size-3.5 animate-spin" aria-hidden="true" />
          <ExternalLink v-else class="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div v-if="accountsPending" class="flex flex-col gap-2 py-3 pr-4 pl-[68px]" aria-hidden="true">
        <div class="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div class="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
      </div>

      <div v-else-if="accountsError" class="flex items-center justify-between gap-3 py-3 pr-4 pl-[68px] text-[13px]">
        <span class="text-rose-800">Impossible de charger les comptes.</span>
        <button type="button" class="min-h-11 font-semibold text-indigo-700" @click="refetch()">Réessayer</button>
      </div>

      <div v-else-if="!accounts?.length" class="flex items-center justify-between gap-3 py-3 pr-4 pl-[68px] text-[13px]">
        <span class="text-slate-500">
          Aucun compte pour cette connexion.
          <span v-if="remove.isError.value" class="block font-semibold text-rose-800">La suppression a échoué, réessayez.</span>
        </span>
        <button
          v-if="removable"
          type="button"
          class="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-slate-700 px-2.5 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="remove.isPending.value"
          @click="startRemove"
        >
          Supprimer
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
      :title="`Supprimer ${bankName} ?`"
      confirm-label="Supprimer"
      tone="danger"
      :icon="Trash2"
      :pending="remove.isPending.value"
      :error="remove.isError.value ? 'La suppression a échoué, réessayez.' : null"
      @confirm="confirmRemove"
    >
      <p>Cette connexion ne contient aucun compte. Elle sera retirée de votre liste.</p>
    </ConfirmDialog>
  </article>
</template>
