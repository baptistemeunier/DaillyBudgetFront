// System category labels by locale (the API keeps name = null for them).
import { CATEGORY_LABELS_EN } from './categories.en'
import { CATEGORY_LABELS_FR } from './categories.fr'

export type CategoryLocale = 'fr' | 'en'

const LABELS: Record<CategoryLocale, Record<string, string>> = {
  fr: CATEGORY_LABELS_FR,
  en: CATEGORY_LABELS_EN,
}

/** Label of a system category code; falls back to French, then undefined. */
export function categoryLabel(code: string, locale: CategoryLocale = 'fr'): string | undefined {
  return LABELS[locale][code] ?? CATEGORY_LABELS_FR[code]
}

/** Catalog order of the codes (roots and sub-categories). */
export const CATEGORY_ORDER = new Map(Object.keys(CATEGORY_LABELS_FR).map((code, i) => [code, i]))
