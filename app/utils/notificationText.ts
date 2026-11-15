// Title and body of a notification, from its type + data: the single source of the notification texts,
// used by the inbox (NotificationRow, with vue-i18n) and by the service worker for Web Push
// (service-worker/sw.ts, with the same locale files). Keys: notifications.types.<TYPE>.*
// No Nuxt / Vue import here: the service worker bundles this file. Dates go through Intl with the given locale.
// Relative import (not ~/): the service worker bundle doesn't know the Nuxt aliases.
import { categoryLabel } from '../i18n/categories'
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

/** "412,30 €" (signs dropped: the text says whether it is spent or received). */
const money = (amount: string | undefined, currency: string | undefined, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(Math.abs(Number(amount ?? 0)))

/** "-35,20 €": a balance keeps its sign (overdraft). */
const signedMoney = (amount: string | undefined, currency: string | undefined, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(Number(amount ?? 0))

/** "novembre" from "2026-11". */
const monthName = (month: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))

/** null for a type this code doesn't know (an older service worker receiving a newer type). */
export function notificationText(
  type: string,
  data: AppNotification['data'],
  createdAt: string | null,
  { t, locale, hideAmounts = false, now = Date.now() }: NotificationTextOptions,
): NotificationText | null {
  const d = data ?? {}
  const key = (name: string) => `notifications.types.${type}.${name}`
  const account = d.accountName ?? t('notifications.yourAccount')
  // User category: its name; system category: the front label of its code.
  const category = () =>
    d.categoryName ?? (d.categoryCode ? categoryLabel(d.categoryCode, locale === 'en' ? 'en' : 'fr') : undefined) ?? t('notifications.aCategory')
  const month = () => monthName(d.month ?? (createdAt ?? new Date(now).toISOString()).slice(0, 7), locale)

  /** LARGE_TRANSACTION / INCOME_RECEIVED: one transaction, or several grouped in one notification (count). */
  const transactionText = (): NotificationText => {
    if (d.count) return { title: t(key('titleGrouped'), { n: d.count, count: d.count }, d.count), body: t(key('bodyGrouped'), { account }) }
    const description = d.description?.trim()
    const body = description ? t(key('body'), { description, account }) : account
    if (hideAmounts) return { title: t(key('titleHidden')), body }
    return { title: t(key('title'), { amount: money(d.amount, d.currency, locale) }), body }
  }

  /** BUDGET_ALMOST_EXCEEDED / BUDGET_EXCEEDED. */
  const budgetText = (): NotificationText => ({
    title: t(key('title'), { category: category() }),
    body: hideAmounts
      ? t(key('bodyHidden'), { month: month() })
      : t(key('body'), { spent: money(d.spent, d.currency, locale), budget: money(d.budget, d.currency, locale), month: month() }),
  })
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
      const count = d.count ?? 0
      return {
        title: t(key('title'), { month: month() }),
        body: t(key('body'), { n: count, count }, count),
      }
    }
    case 'BALANCE_LOW':
      return {
        title: t(key('title'), { account }),
        body: hideAmounts
          ? t(key('bodyHidden'))
          : t(key('body'), { balance: signedMoney(d.balance, d.currency, locale), threshold: signedMoney(d.threshold, d.currency, locale) }),
      }
    case 'LARGE_TRANSACTION':
    case 'INCOME_RECEIVED':
      return transactionText()
    case 'BUDGET_ALMOST_EXCEEDED':
    case 'BUDGET_EXCEEDED':
      return budgetText()
    default:
      return null
  }
}
