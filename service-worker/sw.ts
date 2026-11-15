/// <reference lib="webworker" />
// Service worker (@vite-pwa/nuxt v2, buildSW strategy, bundled to sw.js): precaches the app shell like the former generateSW,
// and shows the Web Push notifications sent by the API (docs/NOTIFICATIONS.md).
// Workbox runtime of vite-pwa v2 (its own fork of workbox-core / -precaching / -routing).
import { clientsClaim } from '@vite-pwa/workbox-swkit/core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from '@vite-pwa/workbox-swkit/precaching'
import { NavigationRoute, registerRoute } from '@vite-pwa/workbox-swkit/routing'
// The push text is written here, with the same texts as the inbox (only the notifications part of the files).
import { notifications as notificationsEn } from '../app/i18n/locales/en.json'
import { notifications as notificationsFr } from '../app/i18n/locales/fr.json'
import { notificationText, type Translate } from '../app/utils/notificationText'

declare const self: ServiceWorkerGlobalScope

// registerType 'prompt': a new worker waits until the app asks for it (app/plugins/pwa-update.client.ts,
// never during an OAuth / bank callback), then takes over and the page reloads.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') self.skipWaiting()
})
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA navigations fall back to the shell; /api/** (bank data, OAuth) always goes to the network.
// '/' is precached through additionalManifestEntries (nuxt.config.ts). If it ever is not,
// createHandlerBoundToURL throws (non-precached-url) and the whole worker would fail to install:
// without the fallback, navigations simply go to the network.
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('/'), { denylist: [/^\/api\//] }))
} catch (error) {
  console.warn('[sw] no navigation fallback', error)
}

/**
 * Payload of a push, written by the API (PushMessageFactory): the type and its data, not the text.
 * title / body are only a fallback (older API, or a type this worker doesn't know).
 */
interface PushPayload {
  type?: string
  data?: Record<string, unknown> | null
  /** "fr" / "en": language of the subscription. */
  locale?: string
  /** No amount on the lock screen (setting of the user). */
  hideAmounts?: boolean
  /** Screen to open, e.g. "/transactions/to-categorize". */
  url?: string
  /** Same tag: replaces the previous notification instead of stacking. */
  tag?: string
  /** IRI of the notification ("/notifications/{id}"), marked read when the push is opened. */
  notification?: string
  title?: string
  body?: string
}

const MESSAGES: Record<string, { notifications: unknown }> = {
  fr: { notifications: notificationsFr },
  en: { notifications: notificationsEn },
}

/** Minimal vue-i18n: dotted key, {named} values, "zero | one | many" or "one | many" plural forms. */
function translator(locale: string): Translate {
  const messages = MESSAGES[locale] ?? MESSAGES.fr!
  return (key, named = {}, plural) => {
    const found = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages)
    if (typeof found !== 'string') return key
    const forms = found.split(' | ')
    const index =
      plural === undefined ? 0 : forms.length === 3 ? Math.min(plural, 2) : forms.length === 2 ? (plural === 1 ? 0 : 1) : 0
    return (forms[index] ?? forms[0]!).replace(/\{(\w+)\}/g, (_, name: string) => String(named[name] ?? ''))
  }
}

/** Title + body of the push: built from type + data; generic for an unknown type or no payload. */
function pushText(payload: PushPayload | undefined): { title: string; body: string } {
  const locale = payload?.locale === 'en' ? 'en' : 'fr'
  const t = translator(locale)
  const text = payload?.type
    ? notificationText(payload.type, (payload.data ?? null) as never, null, { t, locale, hideAmounts: payload.hideAmounts })
    : null
  if (text) return text
  // A push must always show a notification (userVisibleOnly), e.g. the "Push" button of Firefox about:debugging.
  return { title: payload?.title ?? 'Daily Budget', body: payload?.body ?? t('notifications.fallback') }
}

self.addEventListener('push', (event) => {
  let payload: PushPayload | undefined
  try {
    payload = event.data?.json() as PushPayload | undefined
  } catch {
    const text = event.data?.text()
    payload = text ? { body: text } : undefined
  }
  const { title, body } = pushText(payload)

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload?.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: payload?.url ?? '/notifications', notification: payload?.notification ?? null },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data ?? {}) as { url?: string; notification?: string | null }

  // ?notification={id}: the app marks it read on arrival (app/plugins/push.client.ts).
  const target = new URL(data.url ?? '/', self.location.origin)
  const id = data.notification?.split('/').filter(Boolean).pop()
  if (id) target.searchParams.set('notification', id)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        await open.navigate(target.href)
        return
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})

// The browser renewed the subscription: subscribe again with the same key. The worker has no access token,
// so the API is updated by the app at its next opening (usePushDevice().resync()).
self.addEventListener('pushsubscriptionchange', (event) => {
  const change = event as Event & { oldSubscription?: PushSubscription | null; waitUntil: (p: Promise<unknown>) => void }
  const key = change.oldSubscription?.options.applicationServerKey
  if (!key) return
  change.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
})
