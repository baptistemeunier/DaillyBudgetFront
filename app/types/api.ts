// Shapes of the dailyBudget API (HAL). See dailyBudget/docs/DESIGN.md.

export interface HalLink {
  href: string
}

export interface HalResource {
  _links: { self: HalLink; [rel: string]: HalLink | HalLink[] | undefined }
}

export interface HalCollection<T> {
  _links: { self: HalLink; next?: HalLink; item?: HalLink[] }
  _embedded?: { item?: T[] }
  totalItems?: number
  itemsPerPage?: number
}

export type RequisitionStatus = 'CR' | 'GC' | 'UA' | 'RJ' | 'SA' | 'GA' | 'LN' | 'EX' | 'SU'
export type AccountSyncStatus = 'PENDING' | 'IN_PROGRESS' | 'FAILED' | 'SUCCESS'

export interface AccountConnection extends HalResource {
  externalId: string
  externalStatus: RequisitionStatus
  createdAt: string
  updatedAt: string
  _links: HalResource['_links'] & { bank?: HalLink; accounts?: HalLink; configure?: HalLink }
}

export interface Account extends HalResource {
  name: string | null
  displayName: string | null
  iban: string | null
  externalId: string
  externalStatus: string | null
  externalUpdatedAt: string | null
  synchronizedStatus: AccountSyncStatus | null
  synchronizedAt: string | null
  /** Balance reported by the bank at the last sync (decimal string), null before the first one. */
  balance: string | null
  balanceCurrency: string | null
  /** Bank balance kind (e.g. "interimAvailable", "closingBooked"). */
  balanceType: string | null
  /** Date the bank reports the balance for. */
  balanceAt: string | null
  _links: HalResource['_links'] & { 'account-connection'?: HalLink; bank?: HalLink }
}

export interface Transaction extends HalResource {
  reference: string
  description: string
  detail: string | null
  amount: string // decimal string, e.g. "-23.48"
  currency: string
  bookingAt: string | null
  isBooked: boolean
  /** Categorized when the sum equals `amount`; the difference is uncategorized. */
  splits?: TransactionSplit[]
  _links: HalResource['_links'] & { account?: HalLink }
}

/**
 * Category relation: an IRI ("/categories/{id}"), or HAL links depending on
 * how the API renders this embedded non-resource object — see splitCategoryIri().
 */
export interface TransactionSplit {
  amount: string
  category?: string | null | { _links?: { self?: HalLink } }
  _links?: { category?: HalLink }
}

export type CategoryType = 'expense' | 'income' | 'transfer'

export interface Category extends HalResource {
  code: string | null
  /** null for system categories: the label comes from the front i18n table, by code. */
  name: string | null
  /** Owned by the API; sub-categories inherit the type of their root. */
  type: CategoryType
  parent?: string | null
  _links: HalResource['_links'] & { parent?: HalLink }
}

export interface Bank extends HalResource {
  id: string
  name: string
  logo: string | null
  countries: string[]
}

export type UserActionType =
  | 'CONNECTION_EXPIRED'
  | 'CONNECTION_TO_CONFIGURE'
  | 'CONNECTION_EXPIRING'
  | 'TRANSACTIONS_TO_CATEGORIZE'

/** Something the user has to deal with, from GET /user_actions (sorted by priority). */
export interface UserAction extends HalResource {
  id: string
  type: UserActionType
  priority: number
  /** End of the bank access (connection actions). */
  expiresAt: string | null
  /** Number of transactions to categorize. */
  count: number | null
  _links: HalResource['_links'] & { accountConnection?: HalLink; 'account-connection'?: HalLink; bank?: HalLink }
}

/** Root expense category + amount. Same HAL rendering as a split: read the IRI with splitCategoryIri(). */
export type BudgetLine = TransactionSplit

export interface BudgetLineInput {
  category: string // IRI
  amount: string
}

/** Monthly budget of the user (one per user), split across root expense categories. */
export interface Budget extends HalResource {
  amount: string
  currency: string
  lines: BudgetLine[]
  allocatedAmount?: string | null
  unallocatedAmount?: string | null
}

/** Amount of a root category over a statement period. */
export interface StatementLine {
  category?: string | null | { _links?: { self?: HalLink } }
  _links?: { category?: HalLink }
  /** Spent (expenses) or received (income), positive for a normal flow. */
  amount: string
  /** Prorated budget of the category; 0.00 outside the budget, absent for income. */
  targetAmount?: string | null
  transactionCount?: number
}

/** Expenses and income over whole months, compared to the budget (GET /statements/{period}). */
export interface Statement extends HalResource {
  period: string
  from: string
  to: string
  months: number
  currency: string
  /** Budget × number of months (0.00 without budget). */
  targetAmount: string
  amount: string
  lines: StatementLine[]
  unbudgetedAmount: string
  uncategorizedAmount: string
  uncategorizedCount?: number
  incomeAmount: string
  income: StatementLine[]
  uncategorizedIncomeAmount: string
  uncategorizedIncomeCount?: number
  /** One entry per category (sub-category or root) with splits, expenses and income; grouped by `parent`. */
  details?: StatementDetail[]
}

/** Amount of a single category over a statement period; a split made on a root has category = parent = root. */
export interface StatementDetail {
  category?: string | null | { _links?: { self?: HalLink } }
  parent?: string | null | { _links?: { self?: HalLink } }
  _links?: { category?: HalLink; parent?: HalLink }
  amount: string
  transactionCount?: number
}
