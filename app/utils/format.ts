/** "12.34" / "-5" -> integer cents, without float arithmetic. */
export function toCents(amount: string): number {
  const negative = amount.trim().startsWith('-')
  const [int = '0', dec = ''] = amount.trim().replace(/^[-+]/, '').split('.')
  const cents = Number(int) * 100 + Number((dec + '00').slice(0, 2))
  return negative ? -cents : cents
}

/**
 * Typed amount -> positive cents; invalid -> null. French: "2 100,5" or "12.50";
 * English: "2,100.50" (commas are thousands separators).
 */
export function parseAmountInput(input: string): number | null {
  const compact = input.trim().replace(/[\s\u00a0\u202f]/g, '')
  const v = appLocale() === 'en' ? compact.replace(/,/g, '') : compact.replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(v)) return null
  return toCents(v)
}

/** Signed API decimal without float maths: -1250 -> "-12.50". */
export function centsToDecimal(cents: number): string {
  const abs = Math.abs(cents)
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Cents -> input value: 210000 -> "2100", 1250 -> "12,50" (English: "12.50"). */
export function centsToInput(cents: number, keepDecimals = false): string {
  const abs = Math.abs(cents)
  if (!keepDecimals && abs % 100 === 0) return String(abs / 100)
  const value = (abs / 100).toFixed(2)
  return appLocale() === 'en' ? value : value.replace('.', ',')
}

/** Amount without decimals when round: "2 100 €", "12,50 €" (English: "€2,100", "€12.50"). */
export function formatCentsShort(cents: number, currency = 'EUR'): string {
  const digits = cents % 100 === 0 ? 0 : 2
  return localeFormatter(
    `currency-short|${currency}|${digits}`,
    (l) =>
      new Intl.NumberFormat(l, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }),
  ).format(cents / 100)
}

export function formatCents(cents: number, currency = 'EUR'): string {
  return localeFormatter(`currency|${currency}`, (l) => new Intl.NumberFormat(l, { style: 'currency', currency })).format(
    cents / 100,
  )
}

/** "FR7630006000011234567890189" -> "FR76 •••• 0189" */
export function maskIban(iban: string | null): string {
  if (!iban) return ''
  const clean = iban.replace(/\s/g, '')
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`
}

/** "Crédit Agricole" -> "CA" */
export function initials(name: string): string {
  return (
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  )
}

/** Signed amount: "+2 441,61 €" / "−23,48 €" (U+2212 minus). */
export function formatSignedCents(cents: number, currency = 'EUR'): string {
  const sign = cents > 0 ? '+' : cents < 0 ? '−' : ''
  return sign + formatCents(Math.abs(cents), currency)
}

const TZ = 'Europe/Paris'
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "YYYY-MM-DD" of a date, in Europe/Paris. */
export function dayKey(date: Date | string): string {
  return dayKeyFormat.format(typeof date === 'string' ? new Date(date) : date)
}

/** "Aujourd'hui", "Hier", "Mercredi 11 novembre" (+ year if not the current one). */
export function dayLabel(key: string, now = new Date()): string {
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000))
  if (key === today) return i18nT('dates.today')
  if (key === yesterday) return i18nT('dates.yesterday')

  // Noon UTC keeps the same calendar day once shown in Europe/Paris.
  const date = new Date(`${key}T12:00:00Z`)
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  const format = localeFormatter(
    `day|${sameYear}`,
    (l) =>
      new Intl.DateTimeFormat(l, {
        timeZone: TZ,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        ...(sameYear ? {} : { year: 'numeric' }),
      }),
  )
  return capitalize(format.format(date))
}

/** "12/11/2026" (English: "12/11/2026" too, day first). */
export function formatDate(date: string | Date): string {
  return localeFormatter('date', (l) => new Intl.DateTimeFormat(l, { timeZone: TZ })).format(new Date(date))
}

/** "novembre" / "November": name of a "YYYY-MM" month. */
export function monthName(month: string): string {
  return localeFormatter('month-name', (l) => new Intl.DateTimeFormat(l, { month: 'long', timeZone: 'UTC' })).format(
    new Date(`${month}-15T12:00:00Z`),
  )
}

/** "il y a 2 heures", "hier"… (English: "2 hours ago", "yesterday"). */
export function relativeTime(date: string | Date, now = Date.now()): string {
  const diff = (new Date(date).getTime() - now) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) {
      const relative = localeFormatter('relative', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto' }))
      return relative.format(Math.round(diff / seconds), unit)
    }
  }
  return i18nT('dates.justNow')
}
