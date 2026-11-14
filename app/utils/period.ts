// Periods of whole months, as used by GET /statements/{period}: "2026-11" or "2026-09..2026-11".
// Months are "YYYY-MM" strings, in Europe/Paris.

export const PERIOD_LENGTHS = [1, 3, 6, 12] as const
export type PeriodLength = (typeof PERIOD_LENGTHS)[number]

export function currentMonth(now = new Date()): string {
  return dayKey(now).slice(0, 7)
}

/** "2026-11" + -2 -> "2026-09" */
export function addMonths(month: string, n: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Last month `to` + length -> API period. */
export function periodOf(to: string, months: number): string {
  const from = addMonths(to, -(months - 1))
  return from === to ? to : `${from}..${to}`
}

/** API period -> booking date bounds: { after: first day, strictlyBefore: first day after the last month }. */
export function periodBounds(period: string): { after: string; strictlyBefore: string } {
  const [from, to = from] = period.split('..') as [string, string?]
  return { after: `${from}-01`, strictlyBefore: `${addMonths(to!, 1)}-01` }
}

const monthDate = (month: string) => new Date(`${month}-15T12:00:00Z`)
const longMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Novembre 2026", "Sept. – nov. 2026", "Déc. 2025 – nov. 2026". */
export function periodLabel(to: string, months: number): string {
  if (months === 1) return capitalize(longMonth.format(monthDate(to)))
  const from = addMonths(to, -(months - 1))
  const toLabel = `${shortMonth.format(monthDate(to))} ${to.slice(0, 4)}`
  const fromLabel =
    from.slice(0, 4) === to.slice(0, 4)
      ? shortMonth.format(monthDate(from))
      : `${shortMonth.format(monthDate(from))} ${from.slice(0, 4)}`
  return `${capitalize(fromLabel)} – ${toLabel}`
}

/** Days left in the current month (today included) when the period ends this month, else null. */
export function daysLeft(to: string, now = new Date()): number | null {
  const today = dayKey(now)
  if (to !== today.slice(0, 7)) return null
  const year = Number(to.slice(0, 4))
  const month = Number(to.slice(5, 7))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return lastDay - Number(today.slice(8, 10)) + 1
}
