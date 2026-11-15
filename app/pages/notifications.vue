<script setup lang="ts">
// Inbox: the notifications, the most recent first, grouped by day (Paris).
// A tap marks the notification read and opens its screen; "Tout lire" marks every unread one.
// The carousel "À faire" stays the view of the current state; this is the history.
import type { AppNotification } from '~/types/api'

const router = useRouter()
const { t } = useI18n()

const {
  data: pages,
  isPending,
  isError,
  isFetchingNextPage,
  isFetchNextPageError,
  hasNextPage,
  fetchNextPage,
  refetch,
} = useNotificationsQuery()
const { data: unreadCount } = useUnreadNotificationsCountQuery()

const markRead = useMarkNotificationRead()
const markAll = useMarkAllNotificationsRead()
const remove = useDeleteNotification()
const error = ref<string | null>(null)

// Pages merged (deduped), unknown types left out, then grouped by day.
const groups = computed(() => {
  const seen = new Set<string>()
  const byDay = new Map<string, AppNotification[]>()
  for (const page of pages.value?.pages ?? []) {
    for (const n of halItems(page)) {
      if (seen.has(n._links.self.href) || !isHandledNotification(n)) continue
      seen.add(n._links.self.href)
      const key = dayKey(n.createdAt)
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(n)
    }
  }
  return [...byDay.entries()].map(([key, items]) => ({ key, label: dayLabel(key), items }))
})
const isEmpty = computed(() => !isPending.value && !isError.value && groups.value.length === 0)

function open(n: AppNotification, to: string) {
  // Not awaited: the screen opens at once, the read state follows.
  if (!n.read) markRead.mutate(n)
  router.push(to)
}

async function readAll() {
  error.value = null
  try {
    await markAll.mutateAsync()
  } catch {
    error.value = t('notifications.markAllFailed')
  }
}

async function deleteOne(n: AppNotification) {
  error.value = null
  try {
    await remove.mutateAsync(n)
  } catch {
    error.value = t('errors.deleteFailedRetry')
  }
}

const scroller = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
useInfiniteScroll(scroller, sentinel, { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage })
</script>

<template>
  <div ref="scroller" class="flex h-dvh flex-col overflow-y-auto">
    <main class="flex flex-col gap-4 px-4 pt-6 pb-10">
      <PageHeader :title="$t('notifications.title')" back="/">
        <template #trailing>
          <button
            v-if="unreadCount"
            type="button"
            class="-mr-2 min-h-11 flex-none rounded-full px-3 text-sm font-semibold whitespace-nowrap text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            :disabled="markAll.isPending.value"
            @click="readAll"
          >
            {{ $t('notifications.markAllRead') }}
          </button>
        </template>
      </PageHeader>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

      <div v-if="isPending" class="flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 5" :key="i" class="h-20 animate-pulse rounded-2xl bg-white" />
      </div>

      <div v-else-if="isError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">{{ $t('notifications.loadFailed') }}</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          {{ $t('common.retry') }}
        </button>
      </div>

      <p v-else-if="isEmpty" class="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        {{ $t('notifications.empty') }}
      </p>

      <template v-else>
        <section v-for="group in groups" :key="group.key" class="flex flex-col gap-2" :aria-labelledby="`notif-day-${group.key}`">
          <h2 :id="`notif-day-${group.key}`" class="text-[13px] font-semibold text-slate-600">{{ group.label }}</h2>
          <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <li v-for="n in group.items" :key="n._links.self.href">
              <NotificationRow :notification="n" @open="(to) => open(n, to)" @delete="deleteOne(n)" />
            </li>
          </ul>
        </section>

        <div v-if="isFetchingNextPage" class="flex flex-col gap-2" aria-hidden="true">
          <div v-for="i in 2" :key="i" class="h-20 animate-pulse rounded-2xl bg-white" />
        </div>
        <div v-else-if="isFetchNextPageError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
          <span class="text-sm text-rose-800">{{ $t('common.loadInterrupted') }}</span>
          <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="fetchNextPage()">
            {{ $t('common.retry') }}
          </button>
        </div>

        <div v-if="hasNextPage" ref="sentinel" class="h-px" aria-hidden="true" />
      </template>
    </main>
  </div>
</template>
