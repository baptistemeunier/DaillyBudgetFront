// Title and body of a notification, from its type + data: the single source of the notification texts,
// used by the inbox (NotificationRow, with vue-i18n) and by the service worker for Web Push
// (service-worker/sw.ts, with the same locale files). Keys: notifications.types.<TYPE>.*
// No Nuxt / Vue import here: the service worker bundles this file. Dates go through Intl with the given locale.
import type { AppNotification } from '~/types/api'

/** vue-i18n-like: named values; with `plural`, picks the form ("zero | one | many" or "one | many"). */
export type Translate = (key: string, named?: Record<string, unknown>, plural?: number) => string

export interface NotificationTextOptions {
  t: Translate
  locale: string
  /** Push only: no amount on the lock screen (the current types have none). */
  hideAmounts?: boolean
  now?: number
}

export interface NotificationText {
  title: string
  body: string
}

const TZ = 'Europe/Paris'

function relative(date: string, locale: string, now: number): string {
  const diff = (new Date(date).getTime() - now) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return format.format(Math.round(diff / seconds), unit)
  }
  return format.format(0, 'minute')
}

const shortDate = (date: string, locale: string) => new Intl.DateTimeFormat(locale, { timeZone: TZ }).format(new Date(date))

/** "novembre" from "2026-11". */
const monthName = (month: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))

/** null for a type this code doesn't know (an older service worker receiving a newer type). */
export function notificationText(
  type: string,
  data: AppNotification['data'],
  createdAt: string | null,
  { t, locale, now = Date.now() }: NotificationTextOptions,
): NotificationText | null {
  const d = data ?? {}
  const key = (name: string) => `notifications.types.${type}.${name}`
  // Bank name written by the API in data (the service worker has no token to fetch it).
  const title = () => (d.bankName ? t(key('title'), { bank: d.bankName }) : t(key('titleGeneric')))

  switch (type) {
    case 'CONNECTION_EXPIRING':
      return {
        title: title(),
        body: d.expiresAt ? t(key('body'), { when: relative(d.expiresAt, locale, now) }) : t(key('bodyNoDate')),
      }
    case 'CONNECTION_EXPIRED':
      return {
        title: title(),
        body: d.expiresAt ? t(key('body'), { date: shortDate(d.expiresAt, locale) }) : t(key('bodyNoDate')),
      }
    case 'CONNECTION_TO_CONFIGURE':
      return { title: title(), body: t(key('body')) }
    case 'MONTH_CLOSING': {
      const month = d.month ?? (createdAt ?? new Date(now).toISOString()).slice(0, 7)
      const count = d.count ?? 0
      return {
        title: t(key('title'), { month: monthName(month, locale) }),
        body: t(key('body'), { n: count, count }, count),
      }
    }
    default:
      return null
  }
}
