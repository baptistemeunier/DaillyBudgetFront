// Countries covered by GoCardless Bank Account Data, plus the sandbox (XX).
const GOCARDLESS_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE',
  'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB',
]

export const SANDBOX_COUNTRY = 'XX'

export interface Country {
  code: string
  name: string
  flag: string
}

function flag(code: string) {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function bankCountries(): Country[] {
  const names = new Intl.DisplayNames(['fr'], { type: 'region' })
  const list = GOCARDLESS_COUNTRIES.map((code) => ({ code, name: names.of(code) ?? code, flag: flag(code) })).sort(
    (a, b) => a.name.localeCompare(b.name, 'fr'),
  )
  // France first, sandbox last.
  const fr = list.findIndex((c) => c.code === 'FR')
  if (fr > 0) list.unshift(...list.splice(fr, 1))
  return [...list, { code: SANDBOX_COUNTRY, name: 'Test (bac à sable)', flag: '🧪' }]
}

export function countryName(code: string): string {
  return bankCountries().find((c) => c.code === code)?.name ?? code
}

/** Lowercase, accents stripped — for local search. */
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
