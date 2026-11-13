/** "12.34" / "-5" -> integer cents, without float arithmetic. */
export function toCents(amount: string): number {
  const negative = amount.trim().startsWith('-')
  const [int = '0', dec = ''] = amount.trim().replace(/^[-+]/, '').split('.')
  const cents = Number(int) * 100 + Number((dec + '00').slice(0, 2))
  return negative ? -cents : cents
}

export function formatCents(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100)
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
  if (key === today) return "Aujourd'hui"
  if (key === yesterday) return 'Hier'

  // Noon UTC keeps the same calendar day once shown in Europe/Paris.
  const date = new Date(`${key}T12:00:00Z`)
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  const label = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

/** "il y a 2 heures", "hier"… */
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
    if (Math.abs(diff) >= seconds) return relative.format(Math.round(diff / seconds), unit)
  }
  return "à l'instant"
}
