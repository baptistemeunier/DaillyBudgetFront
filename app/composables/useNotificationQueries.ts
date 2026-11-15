import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/vue-query'
import type { AppNotification, HalCollection, NotificationSettings, NotificationType, PushSubscriptionResource } from '~/types/api'

/** The API may send types this front doesn't handle yet (later steps): they are not shown. */
const HANDLED_NOTIFICATIONS: string[] = [
  'CONNECTION_EXPIRING',
  'CONNECTION_EXPIRED',
  'CONNECTION_TO_CONFIGURE',
  'MONTH_CLOSING',
  'BALANCE_LOW',
  'LARGE_TRANSACTION',
  'INCOME_RECEIVED',
  'BUDGET_ALMOST_EXCEEDED',
  'BUDGET_EXCEEDED',
] satisfies NotificationType[]

export const isHandledNotification = (n: AppNotification) => HANDLED_NOTIFICATIONS.includes(n.type)

/** The inbox, the most recent first, page by page. */
export function useNotificationsQuery() {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    staleTime: 0,
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<HalCollection<AppNotification>>(pageParam || '/notifications?page=1'),
    getNextPageParam: (last) => last._links.next?.href,
  })
}

/** Unread count for the bell: totalItems of a one-item page, no dedicated endpoint. */
export function useUnreadNotificationsCountQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () =>
      (await api<HalCollection<AppNotification>>('/notifications', { query: { read: 'false', itemsPerPage: 1 } }))
        .totalItems ?? 0,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
  })
}

type QueryClient = ReturnType<typeof useQueryClient>

/** Applies a change to every cached inbox page (rows stay in place until the next refetch). */
function patchInbox(queryClient: QueryClient, change: (items: AppNotification[]) => AppNotification[]) {
  queryClient.setQueriesData<InfiniteData<HalCollection<AppNotification>>>(
    { queryKey: ['notifications', 'list'] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          _embedded: page._embedded && { ...page._embedded, item: change(page._embedded.item ?? []) },
        })),
      },
  )
}

function readRequest(api: ReturnType<typeof useApi>, href: string) {
  return api<AppNotification>(href, {
    method: 'PATCH',
    body: { read: true },
    headers: { 'Content-Type': 'application/merge-patch+json' },
  })
}

/** PATCH {read: true}: the API sets readAt. */
export function useMarkNotificationRead() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notification: AppNotification) => readRequest(api, notification._links.self.href),
    onSuccess: (updated) => {
      patchInbox(queryClient, (items) =>
        items.map((n) => (n._links.self.href === updated._links.self.href ? { ...n, ...updated } : n)),
      )
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}

/**
 * "Tout marquer comme lu": no bulk endpoint, one PATCH per unread notification
 * (all of them, not only the loaded pages). They are few thanks to the anti-spam keys.
 */
export function useMarkAllNotificationsRead() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const unread = await fetchAllPages<AppNotification>(api, '/notifications', { read: 'false' })
      const results = await Promise.allSettled(unread.map((n) => readRequest(api, n._links.self.href)))
      if (results.some((r) => r.status === 'rejected')) throw new Error('Some notifications could not be marked as read')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteNotification() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notification: AppNotification) => api(notification._links.self.href, { method: 'DELETE' }),
    onSuccess: (_, notification) => {
      patchInbox(queryClient, (items) => items.filter((n) => n._links.self.href !== notification._links.self.href))
      if (!notification.read) queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })
}

/** Push default of each type, as NotificationType::defaultPush() on the API. */
export const PUSH_DEFAULTS: Record<NotificationType, boolean> = {
  CONNECTION_EXPIRING: true,
  CONNECTION_EXPIRED: true,
  CONNECTION_TO_CONFIGURE: true,
  MONTH_CLOSING: true,
  BALANCE_LOW: true,
  LARGE_TRANSACTION: true,
  INCOME_RECEIVED: false,
  BUDGET_ALMOST_EXCEEDED: true,
  BUDGET_EXCEEDED: true,
}

/** NotificationSettings.DEFAULT_LARGE_TRANSACTION_THRESHOLD on the API. */
export const DEFAULT_LARGE_TRANSACTION_THRESHOLD = '200.00'

/** The user's notification settings, or null before the first change. */
export function useNotificationSettingsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['notification_settings'],
    queryFn: async () => halItems(await api<HalCollection<NotificationSettings>>('/notification_settings'))[0] ?? null,
  })
}

/** Creates the settings on the first change (POST), then updates them (PATCH). */
export function useSaveNotificationSettings() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ current, changes }: { current: NotificationSettings | null; changes: Partial<Omit<NotificationSettings, '_links'>> }) =>
      current
        ? api<NotificationSettings>(current._links.self.href, {
            method: 'PATCH',
            body: changes,
            headers: { 'Content-Type': 'application/merge-patch+json' },
          })
        : api<NotificationSettings>('/notification_settings', { method: 'POST', body: changes }),
    onSuccess: (saved) => queryClient.setQueryData(['notification_settings'], saved),
  })
}

/** Devices subscribed to Web Push, the most recent first. */
export function usePushSubscriptionsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['push_subscriptions'],
    queryFn: () => fetchAllPages<PushSubscriptionResource>(api, '/push_subscriptions'),
  })
}

/** Removes another device (this one goes through usePushDevice().disable(), which also unsubscribes). */
export function useDeletePushSubscription() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subscription: PushSubscriptionResource) => api(subscription._links.self.href, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] }),
  })
}
