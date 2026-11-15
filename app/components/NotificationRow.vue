<script setup lang="ts">
// One notification of the inbox: icon, text from notificationText() (the same as the push), age, unread dot.
// A tap marks it read and opens its screen; the cross deletes it.
import { CalendarClock, Clock, Link, Unplug, X } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { AppNotification, NotificationType } from '~/types/api'

const props = defineProps<{ notification: AppNotification }>()
const emit = defineEmits<{ open: [to: string]; delete: [] }>()

const { t, locale } = useI18n()

// Connection link; bank name from data (written by the API), else from the cached connection list.
const connectionHref = computed(
  () => props.notification._links.accountConnection?.href ?? props.notification._links['account-connection']?.href,
)
const { data: connections } = useConnectionsQuery()
const connection = computed(() => connections.value?.find((c) => c._links.self.href === connectionHref.value))
const { data: bank } = useBankQuery(() => (props.notification.data?.bankName ? null : connection.value?._links.bank?.href))
const connectionPage = computed(() =>
  connectionHref.value ? `/profile/connections/${iriId(connectionHref.value)}` : '/profile/connections',
)

// Screen opened by a tap, and icon / tint, per type. The text comes from notificationText() (shared with the push).
const LOOK: Record<NotificationType, { icon: Component; tint: string }> = {
  CONNECTION_EXPIRING: { icon: Clock, tint: 'bg-amber-100 text-amber-700' },
  CONNECTION_EXPIRED: { icon: Unplug, tint: 'bg-rose-100 text-rose-700' },
  CONNECTION_TO_CONFIGURE: { icon: Link, tint: 'bg-amber-100 text-amber-700' },
  MONTH_CLOSING: { icon: CalendarClock, tint: 'bg-indigo-100 text-indigo-700' },
}

const view = computed(() => {
  const n = props.notification
  const data = { ...n.data, bankName: n.data?.bankName ?? bank.value?.name }
  const text = notificationText(n.type, data, n.createdAt, {
    t: (key, named, plural) => (plural === undefined ? t(key, named ?? {}) : t(key, named ?? {}, plural)),
    locale: locale.value,
  }) ?? { title: t('notifications.fallback'), body: '' }
  const to = n.type === 'MONTH_CLOSING' ? '/transactions/to-categorize?accounts=checking' : connectionPage.value
  return { ...LOOK[n.type], ...text, to }
})
</script>

<template>
  <div class="flex items-start" :class="notification.read ? '' : 'bg-indigo-50/50'">
    <button type="button" class="flex min-h-16 min-w-0 flex-1 items-start gap-3 py-3 pl-3.5 text-left" @click="emit('open', view.to)">
      <span class="flex size-10 flex-none items-center justify-center rounded-full" :class="view.tint" aria-hidden="true">
        <component :is="view.icon" class="size-5" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="flex items-center gap-2">
          <span class="min-w-0 flex-1 text-[15px] leading-snug" :class="notification.read ? 'font-medium' : 'font-semibold'">
            {{ view.title }}
          </span>
          <span v-if="!notification.read" class="size-2 flex-none rounded-full bg-indigo-600" aria-hidden="true" />
          <span v-if="!notification.read" class="sr-only">{{ $t('notifications.unread') }}</span>
        </span>
        <span v-if="view.body" class="text-sm text-slate-600">{{ view.body }}</span>
        <span class="text-xs text-slate-400">{{ relativeTime(notification.createdAt) }}</span>
      </span>
    </button>
    <button
      type="button"
      class="mt-1.5 mr-1 flex size-11 flex-none items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      :aria-label="$t('notifications.deleteNamed', { name: view.title })"
      @click="emit('delete')"
    >
      <X class="size-4" />
    </button>
  </div>
</template>
