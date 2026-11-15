<script setup lang="ts">
// Bell of the home header: opens the inbox, with the unread count as a badge.
import { Bell } from 'lucide-vue-next'

const { data: unread } = useUnreadNotificationsCountQuery()
const count = computed(() => unread.value ?? 0)
</script>

<template>
  <NuxtLink
    to="/notifications"
    class="relative flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
    :aria-label="count ? $t('notifications.bellUnread', count) : $t('notifications.title')"
  >
    <Bell class="size-5" />
    <span
      v-if="count"
      class="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white tabular-nums ring-2 ring-slate-50"
      aria-hidden="true"
    >
      {{ count > 9 ? '9+' : count }}
    </span>
  </NuxtLink>
</template>
