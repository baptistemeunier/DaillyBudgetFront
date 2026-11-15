// Web Push on this device: browser support, permission, and the subscription saved on the API
// (PUT /push_subscriptions/{uuid v5 of the endpoint}, idempotent). See docs/NOTIFICATIONS.md, step 2.
// The service worker only exists in a production build (devOptions disabled): in dev, `supported` stays false.
import { useQueryClient } from '@tanstack/vue-query'

interface PushDeviceState {
  /** State read at least once. */
  checked: boolean
  /** Push API available + the VAPID key configured (the worker itself may still be registering). */
  supported: boolean
  /** iOS outside the installed app: Web Push only works from the home screen (iOS 16.4+). */
  needsInstall: boolean
  permission: NotificationPermission
  /** Endpoint of this device's subscription, null when not subscribed. */
  endpoint: string | null
}

/** VAPID key (base64url) → bytes for pushManager.subscribe(). */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

/**
 * Registration with an active worker, waiting for it if needed: the module registers the worker
 * asynchronously (virtual:pwa-register), and pushManager.subscribe() needs it active. null after 10 s.
 */
async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const current = await navigator.serviceWorker.getRegistration()
  if (current?.active) return current
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export const pushSubscriptionIri = async (endpoint: string) => `/push_subscriptions/${await uuidV5(endpoint)}`

export function usePushDevice() {
  const api = useApi()
  const queryClient = useQueryClient()
  const vapidKey = useRuntimeConfig().public.vapidPublicKey as string
  const state = useState<PushDeviceState>('push.device', () => ({
    checked: false,
    supported: false,
    needsInstall: false,
    permission: 'default',
    endpoint: null,
  }))
  const busy = useState('push.device.busy', () => false)

  async function refresh() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    const registration = hasApi ? await swRegistration() : null
    const subscription = await registration?.pushManager.getSubscription()

    state.value = {
      checked: true,
      // Not the registration: the worker may not be registered yet (enable() waits for it).
      supported: hasApi && !!vapidKey,
      needsInstall: ios && !standalone,
      permission: 'Notification' in window ? Notification.permission : 'denied',
      endpoint: subscription?.endpoint ?? null,
    }
  }

  /** Saves (or refreshes) the subscription on the API: same device = same id, so PUT replaces it. */
  async function save(subscription: PushSubscription) {
    const { keys } = subscription.toJSON()
    await api(await pushSubscriptionIri(subscription.endpoint), {
      method: 'PUT',
      body: { endpoint: subscription.endpoint, keys, locale: appLocale() },
    })
    queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] })
  }

  /** Asks the permission (only from a user gesture), subscribes this device and saves it. */
  async function enable(): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    try {
      const permission = await Notification.requestPermission()
      state.value = { ...state.value, permission }
      if (permission !== 'granted') return false

      const registration = await activeRegistration()
      if (!registration) throw new Error('No active service worker after 10 s')
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidKey) }))
      await save(subscription)
      state.value = { ...state.value, endpoint: subscription.endpoint }
      return true
    } finally {
      busy.value = false
    }
  }

  /** Removes this device from the API, then unsubscribes the browser. */
  async function disable() {
    if (busy.value) return
    busy.value = true
    try {
      const subscription = await (await swRegistration())?.pushManager.getSubscription()
      if (!subscription) return
      try {
        await api(await pushSubscriptionIri(subscription.endpoint), { method: 'DELETE' })
      } catch (e) {
        // Already gone on the API (deleted from another device): unsubscribe anyway
        if (apiErrorStatus(e) !== 404) throw e
      }
      await subscription.unsubscribe()
      state.value = { ...state.value, endpoint: null }
      queryClient.invalidateQueries({ queryKey: ['push_subscriptions'] })
    } finally {
      busy.value = false
    }
  }

  /**
   * At each opening / language change: saves the subscription again (new locale, renewed endpoint after
   * pushsubscriptionchange, device taken over by the user now logged in). Silent on failure.
   */
  async function resync() {
    await refresh()
    if (state.value.permission !== 'granted') return
    const subscription = await (await swRegistration())?.pushManager.getSubscription()
    if (!subscription) return
    try {
      await save(subscription)
    } catch {
      // Next opening
    }
  }

  return { state, busy, refresh, enable, disable, resync }
}

/** "Chrome · Android" from a User-Agent (devices list). */
export function deviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null
  const browser =
    [
      [/Edg\//, 'Edge'],
      [/SamsungBrowser\//, 'Samsung Internet'],
      [/Firefox\//, 'Firefox'],
      [/OPR\//, 'Opera'],
      [/Chrome\//, 'Chrome'],
      [/Safari\//, 'Safari'],
    ] as const
  const os = [
    [/Android/, 'Android'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Windows/, 'Windows'],
    [/Mac OS X|Macintosh/, 'macOS'],
    [/CrOS/, 'ChromeOS'],
    [/Linux/, 'Linux'],
  ] as const
  const name = browser.find(([re]) => re.test(userAgent))?.[1]
  const system = os.find(([re]) => re.test(userAgent))?.[1]
  return [name, system].filter(Boolean).join(' · ') || null
}
