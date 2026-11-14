<script setup lang="ts">
import { ArrowRight, Clock, Link, Loader2, Tag, Unplug } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { UserAction } from '~/types/api'

const props = defineProps<{ action: UserAction }>()

const bankHref = computed(() => props.action._links.bank?.href)
const connectionHref = computed(
  () => props.action._links.accountConnection?.href ?? props.action._links['account-connection']?.href,
)

const { data: bank } = useBankQuery(bankHref)
const { data: connections } = useConnectionsQuery()
const bankName = computed(() => bank.value?.name ?? 'bancaire')

// Consent link of a connection to finalize, from the (already loaded) connection list.
const configureHref = computed(
  () => connections.value?.find((c) => c._links.self.href === connectionHref.value)?._links.configure?.href,
)

const reconnect = useReconnectBank()
function startReconnect() {
  if (bankHref.value) reconnect.start(halId({ _links: { self: { href: bankHref.value } } }))
}

const month = new Date().toLocaleDateString('fr-FR', { month: 'long' })
const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')

interface CardView {
  icon: Component
  tint: { badge: string; button: string }
  title: string
  text: string
  cta: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}

const TINTS = {
  rose: { badge: 'bg-rose-100 text-rose-700', button: 'bg-rose-600 text-white' },
  amber: { badge: 'bg-amber-100 text-amber-700', button: 'bg-amber-100 text-amber-800' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700', button: 'bg-indigo-600 text-white' },
}

const view = computed<CardView>(() => {
  const a = props.action
  switch (a.type) {
    case 'CONNECTION_EXPIRED':
      return {
        icon: Unplug,
        tint: TINTS.rose,
        title: `Accès ${bankName.value} expiré`,
        text: a.expiresAt ? `Soldes figés depuis le ${formatDate(a.expiresAt)}.` : 'Vos soldes ne sont plus mis à jour.',
        cta: 'Reconnecter',
        onClick: startReconnect,
        disabled: !bankHref.value,
      }
    case 'CONNECTION_TO_CONFIGURE':
      return {
        icon: Link,
        tint: TINTS.amber,
        title: `Connexion ${bankName.value} à finaliser`,
        text: 'Terminez l’autorisation auprès de votre banque.',
        cta: 'Finaliser',
        href: configureHref.value,
        disabled: !configureHref.value,
      }
    case 'CONNECTION_EXPIRING':
      return {
        icon: Clock,
        tint: TINTS.amber,
        title: `Accès ${bankName.value} bientôt expiré`,
        text: a.expiresAt ? `Expire ${relativeTime(a.expiresAt)}. Renouvelez-le.` : 'Renouvelez-le bientôt.',
        cta: 'Renouveler',
        onClick: startReconnect,
        disabled: !bankHref.value,
      }
    case 'TRANSACTIONS_TO_CATEGORIZE': {
      const n = a.count ?? 0
      return {
        icon: Tag,
        tint: TINTS.indigo,
        title: `${n} transaction${n > 1 ? 's' : ''} à catégoriser`,
        text: `Classe-les pour que ton budget de ${month} soit juste.`,
        cta: 'Catégoriser',
        // No destination yet
        disabled: true,
      }
    }
  }
})

const buttonClass = 'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-60'
</script>

<template>
  <article class="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
    <div class="flex items-start gap-3">
      <span
        aria-hidden="true"
        class="flex size-11 flex-none items-center justify-center rounded-xl"
        :class="view.tint.badge"
      >
        <component :is="view.icon" class="size-5" />
      </span>
      <div class="flex min-w-0 flex-col gap-1">
        <h3 class="text-[17px] leading-snug font-bold">{{ view.title }}</h3>
        <p class="text-sm text-slate-500">{{ view.text }}</p>
        <p v-if="reconnect.isError.value" class="text-sm font-semibold text-rose-800">
          La reconnexion a échoué, réessayez.
        </p>
      </div>
    </div>

    <div class="mt-auto">
      <a v-if="view.href" :href="view.href" :class="[buttonClass, view.tint.button]">
        {{ view.cta }} <ArrowRight class="size-4" aria-hidden="true" />
      </a>
      <button
        v-else
        type="button"
        :class="[buttonClass, view.tint.button]"
        :disabled="view.disabled || reconnect.isPending.value"
        @click="view.onClick?.()"
      >
        {{ view.cta }}
        <Loader2 v-if="reconnect.isPending.value" class="size-4 animate-spin" aria-hidden="true" />
        <ArrowRight v-else class="size-4" aria-hidden="true" />
      </button>
    </div>
  </article>
</template>
