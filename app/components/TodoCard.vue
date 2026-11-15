<script setup lang="ts">
import { ArrowRight, Clock, Link, Loader2, Tag, Unplug, WandSparkles } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { UserAction } from '~/types/api'

const props = defineProps<{ action: UserAction }>()

const bankHref = computed(() => props.action._links.bank?.href)
const connectionHref = computed(
  () => props.action._links.accountConnection?.href ?? props.action._links['account-connection']?.href,
)

const { t } = useI18n()
const { data: bank } = useBankQuery(bankHref)
const { data: connections } = useConnectionsQuery()
const bankName = computed(() => bank.value?.name ?? null)
/** Title with the bank name, or its generic variant while / if the bank is unknown. */
const withBank = (key: string) => (bankName.value ? t(key, { bank: bankName.value }) : t(`${key}Generic`))

// Consent link of a connection to finalize, from the (already loaded) connection list.
const configureHref = computed(
  () => connections.value?.find((c) => c._links.self.href === connectionHref.value)?._links.configure?.href,
)

const reconnect = useReconnectBank()
function startReconnect() {
  if (bankHref.value) reconnect.start(halId({ _links: { self: { href: bankHref.value } } }))
}


interface CardView {
  icon: Component
  tint: { badge: string; button: string }
  title: string
  text: string
  cta: string
  onClick?: () => void
  /** Internal route */
  to?: string
  /** External link (bank consent page) */
  href?: string
  disabled?: boolean
}

const TINTS = {
  rose: { badge: 'bg-rose-100 text-rose-700', button: 'bg-rose-600 text-white' },
  amber: { badge: 'bg-amber-100 text-amber-700', button: 'bg-amber-100 text-amber-800' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700', button: 'bg-indigo-600 text-white' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700', button: 'bg-emerald-100 text-emerald-800' },
}

const view = computed<CardView>(() => {
  const a = props.action
  switch (a.type) {
    case 'CONNECTION_EXPIRED':
      return {
        icon: Unplug,
        tint: TINTS.rose,
        title: withBank('todo.expired.title'),
        text: a.expiresAt ? t('todo.expired.text', { date: formatDate(a.expiresAt) }) : t('todo.expired.textNoDate'),
        cta: t('common.reconnect'),
        onClick: startReconnect,
        disabled: !bankHref.value,
      }
    case 'CONNECTION_TO_CONFIGURE':
      return {
        icon: Link,
        tint: TINTS.amber,
        title: withBank('todo.configure.title'),
        text: t('todo.configure.text'),
        cta: t('common.finalize'),
        href: configureHref.value,
        disabled: !configureHref.value,
      }
    case 'CONNECTION_EXPIRING':
      return {
        icon: Clock,
        tint: TINTS.amber,
        title: withBank('todo.expiring.title'),
        text: a.expiresAt ? t('todo.expiring.text', { when: relativeTime(a.expiresAt) }) : t('todo.expiring.textNoDate'),
        cta: t('todo.expiring.cta'),
        onClick: startReconnect,
        disabled: !bankHref.value,
      }
    case 'TRANSACTIONS_TO_CATEGORIZE': {
      return {
        icon: Tag,
        tint: TINTS.indigo,
        title: t('todo.toCategorize.title', a.count ?? 0),
        text: t('todo.toCategorize.text', { month: monthName(currentMonth()) }),
        cta: t('todo.toCategorize.cta'),
        to: '/transactions/to-categorize',
      }
    }
    case 'TRANSACTIONS_TO_REVIEW':
      return {
        icon: WandSparkles,
        tint: TINTS.emerald,
        title: t('todo.toReview.title', a.count ?? 0),
        text: t('todo.toReview.text'),
        cta: t('todo.toReview.cta'),
        to: '/transactions/to-review',
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
          {{ $t('errors.reconnectFailed') }}
        </p>
      </div>
    </div>

    <div class="mt-auto">
      <NuxtLink v-if="view.to" :to="view.to" :class="[buttonClass, view.tint.button]">
        {{ view.cta }} <ArrowRight class="size-4" aria-hidden="true" />
      </NuxtLink>
      <a v-else-if="view.href" :href="view.href" :class="[buttonClass, view.tint.button]">
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
