import type { Component } from 'vue'

/** One segment of the statement donut. */
export interface DonutSegment {
  key: string
  label: string
  color: string
  cents: number
}

/** One category row of the statement list (also the donut legend). */
export interface StatementRowView {
  key: string
  /** Lucide icon of the category. */
  icon: Component
  label: string
  /** Chart color of the category (identity, matches the donut). */
  color: string
  cents: number
  /** Prorated budget, null when none. */
  targetCents: number | null
  count: number
  /** In %: against the budget on the overview (null without budget), share of the parent on sub-categories. */
  percent: number | null
  currency: string
  /** Detail screen (route location). */
  to?: string | { path: string; query?: Record<string, string> }
}
