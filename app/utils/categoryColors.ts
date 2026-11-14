// Chart colors of the root categories (donut). Validated categorical palette
// (dataviz reference, light mode): color follows the category, never its rank.
// Roots without a slot fold into "Autres"; three slots are below 3:1 on white,
// so the chart always comes with the named list (direct labels).

const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

const SLOT_BY_CODE: Record<string, number> = {
  // expenses
  housing: 0,
  food: 1,
  transport: 2,
  subscriptions: 3,
  shopping: 4,
  health: 5,
  leisure: 6,
  travel: 7,
  // income (shown on its own chart)
  income: 0,
}

export const OTHER_COLOR = '#7c7a73'
export const UNCATEGORIZED_COLOR = '#cfcdc6'

/** Color of a root category, or null when it folds into "Autres". */
export function categoryColor(code: string | null): string | null {
  const slot = code ? SLOT_BY_CODE[code] : undefined
  return slot === undefined ? null : SLOTS[slot]!
}

/** Bar color of spending against a budget: indigo < 80 %, amber up to 100 %, rose beyond. */
export function budgetStatusColor(ratio: number): string {
  if (ratio > 1) return 'bg-rose-500'
  if (ratio >= 0.8) return 'bg-amber-500'
  return 'bg-indigo-600'
}

/** Text color matching budgetStatusColor(). */
export function budgetStatusText(ratio: number): string {
  if (ratio > 1) return 'text-rose-700'
  if (ratio >= 0.8) return 'text-amber-700'
  return 'text-indigo-700'
}
