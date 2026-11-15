<script setup lang="ts">
// One notification of the inbox: icon, text built from type + data (front i18n), age, unread dot.
// A tap marks it read and opens its screen; the cross deletes it.
import { CalendarClock, Clock, Link, Unplug, X } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { AppNotification } from '~/types/api'

const props = defineProps<{ notification: AppNotification }>()
const emit = defineEmits<{ open: [to: string]; delete: [] }>()

const { t } = useI18n()

// Bank of the connection, from the (already cached) connection list.
const connectionHref = computed(
  () => props.notification._links.accountConnection?.href ?? props.notification._links['account-connection']?.href,
)
const { data: connections } = useConnectionsQuery()
const connection = computed(() => connections.value?.find((c) => c._links.self.href === connectionHref.value))
const { data: bank } = useBankQuery(() => connection.value?._links.bank?.href)
const withBank = (key: string) => (bank.value?.name ? t(key, { bank: bank.value.name }) : t(`${key}Generic`))
const connectionPage = computed(() =>
  connectionHref.value ? `/profile/connections/${iriId(connectionHref.value)}` : '/profile/connections',
)

interface RowView {
  icon: Component
  tint: string
  title: string
  text: string
  to: string
}

const view = computed<RowView>(() => {
  const n = props.notification
  const data = n.data ?? {}
  switch (n.type) {
    case 'CONNECTION_EXPIRING':
      return {
        icon: Clock,
        tint: 'bg-amber-100 text-amber-700',
        title: withBank('todo.expiring.title'),
        text: data.expiresAt ? t('todo.expiring.text', { when: relativeTime(data.expiresAt) }) : t('todo.expiring.textNoDate'),
        to: connectionPage.value,
      }
    case 'CONNECTION_EXPIRED':
      return {
        icon: Unplug,
        tint: 'bg-rose-100 text-rose-700',
        title: withBank('todo.expired.title'),
        text: data.expiresAt ? t('todo.expired.text', { date: formatDate(data.expiresAt) }) : t('todo.expired.textNoDate'),
        to: connectionPage.value,
      }
    case 'CONNECTION_TO_CONFIGURE':
      return {
        icon: Link,
        tint: 'bg-amber-100 text-amber-700',
        title: withBank('todo.configure.title'),
        text: t('todo.configure.text'),
        to: connectionPage.value,
      }
    case 'MONTH_CLOSING': {
      const month = data.month ?? n.createdAt.slice(0, 7)
      return {
        icon: CalendarClock,
        tint: 'bg-indigo-100 text-indigo-700',
        title: t('notifications.monthClosing.title', { month: monthName(month) }),
        text: t('notifications.monthClosing.text', data.count ?? 0),
        to: '/transactions/to-categorize?accounts=checking',
      }
    }
  }
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
        <span class="text-sm text-slate-600">{{ view.text }}</span>
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
