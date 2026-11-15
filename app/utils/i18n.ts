// Locale access for code that runs outside a component setup (utils, query functions, computed
// labels). Bound to the global i18n instance by plugins/i18n-bridge.ts. Reading the locale here
// inside a computed / render keeps it reactive: switching language re-renders the labels.
import type { Composer } from 'vue-i18n'

export type AppLocale = 'fr' | 'en'

let composer: Composer | null = null

export function bindI18n(instance: Composer) {
  composer = instance
}

export function appLocale(): AppLocale {
  return composer?.locale.value === 'en' ? 'en' : 'fr'
}

/** BCP 47 tag for the Intl formatters. */
export function intlLocale(): string {
  return appLocale() === 'en' ? 'en-GB' : 'fr-FR'
}

/** t() outside a component; `plural` picks the form ("zero | one | many"). */
export function i18nT(key: string, named: Record<string, unknown> = {}, plural?: number): string {
  if (!composer) return key
  return plural === undefined ? composer.t(key, named) : composer.t(key, named, plural)
}

const formatters = new Map<string, unknown>()

/** Intl formatter built once per locale and `id`. */
export function localeFormatter<T>(id: string, create: (locale: string) => T): T {
  const key = `${intlLocale()}|${id}`
  if (!formatters.has(key)) formatters.set(key, create(intlLocale()))
  return formatters.get(key) as T
}

/** "A", "A et B", "A, B et C" (or "A, B and C"). */
export function formatList(items: string[]): string {
  return localeFormatter('list', (l) => new Intl.ListFormat(l, { type: 'conjunction' })).format(items)
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
