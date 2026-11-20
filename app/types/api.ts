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
/** Account kind, guessed at the first sync and editable. Only checking accounts count in the budget. */
export type AccountType = 'checking' | 'savings' | 'investment'

export interface AccountConnection extends HalResource {
  externalId: string
  externalStatus: RequisitionStatus
  createdAt: string
  updatedAt: string
  /**
   * Connections are shared: configure, sync and delete are only given to their owner (the user who gave the bank consent).
   * An action link is present only when the user may do it.
   */
  _links: HalResource['_links'] & { bank?: HalLink; accounts?: HalLink; configure?: HalLink; sync?: HalLink; delete?: HalLink }
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
  type: AccountType
  /** Created by hand (POST /accounts): no bank, no sync, savings or investment only. */
  manual?: boolean
  /** Checking account: BALANCE_LOW is sent when the balance goes below it (decimal); null = no alert. */
  lowBalanceThreshold?: string | null
  _links: HalResource['_links'] & { 'account-connection'?: HalLink; bank?: HalLink }
}

/** POST /accounts: manual account, starting with an initial transaction. */
export interface CreateManualAccountInput {
  name: string
  type: Exclude<AccountType, 'checking'>
  currency: string
  initialBalance: string // decimal, e.g. "12400.00"
  initialBalanceAt: string // YYYY-MM-DD
}

export interface Transaction extends HalResource {
  reference: string
  description: string
  detail: string | null
  /** Normalized merchant (from the description) used by the categorization rules; null without words. */
  merchantKey?: string | null
  amount: string // decimal string, e.g. "-23.48"
  currency: string
  bookingAt: string | null
  isBooked: boolean
  /** Categorized when the sum equals `amount`; the difference is uncategorized. */
  splits?: TransactionSplit[]
  /** Hidden by the user: still listed and in the balance, left out of the budget and of "to categorize". */
  hidden?: boolean
  _links: HalResource['_links'] & { account?: HalLink }
}

/**
 * Category relation: an IRI ("/categories/{id}"), or HAL links depending on
 * how the API renders this embedded non-resource object — see splitCategoryIri().
 */
export interface TransactionSplit {
  amount: string
  /** "rule": set by a categorization rule, to review; "confirmed": set by a rule and confirmed by the user;
   *  "manual": set or corrected by the user. */
  source?: 'manual' | 'rule' | 'confirmed'
  category?: string | null | { _links?: { self?: HalLink } }
  /** Saving split towards a manual account: its mirror transaction and that account. */
  _links?: { category?: HalLink; counterpartTransaction?: HalLink; counterpartAccount?: HalLink }
}

export type CategoryType = 'expense' | 'income' | 'transfer' | 'saving'

export type TransactionDirection = 'debit' | 'credit'

/**
 * "Always categorize like this": the transactions whose merchant key contains the pattern (whole words),
 * in the direction if given (null: both), get a single split on the category.
 */
export interface CategorizationRule extends HalResource {
  /** Normalized by the API (uppercase words, no accent, no digit): "Carrefour" → "CARREFOUR". */
  pattern: string
  direction: TransactionDirection | null
  /** IRI, or only in _links depending on the HAL rendering — see ruleCategoryIri(). */
  category?: string | null
  createdAt?: string
  /** Rules are shared: delete only given to their owner. */
  _links: HalResource['_links'] & { category?: HalLink; delete?: HalLink }
}

export interface CategorizationRuleInput {
  pattern: string
  direction: TransactionDirection | null
  category: string
}

export interface Category extends HalResource {
  code: string | null
  /** null for system categories: the label comes from the front i18n table, by code. */
  name: string | null
  /** Lucide icon name ("piggy-bank"); null: the parent's. */
  icon?: string | null
  /** Owned by the API; sub-categories inherit the type of their root. */
  type: CategoryType
  parent?: string | null
  /** Saving categories (envelopes) only: amount to reach, optionally by targetDate. */
  targetAmount?: string | null
  targetDate?: string | null
  /** Categories are shared: edit for the users' ones (not system ones), delete only for their owner. */
  _links: HalResource['_links'] & { parent?: HalLink; edit?: HalLink; delete?: HalLink }
}

/** Name and target of a saving envelope (POST / PATCH /categories). */
export interface EnvelopeInput {
  name: string
  icon: string | null
  targetAmount: string | null
  targetDate: string | null // YYYY-MM-DD
}

export interface Bank extends HalResource {
  id: string
  name: string
  logo: string | null
  countries: string[]
}

/** Notification types this front can show (step 1 of docs/NOTIFICATIONS.md). */
export type NotificationType =
  | 'CONNECTION_EXPIRING'
  | 'CONNECTION_EXPIRED'
  | 'CONNECTION_TO_CONFIGURE'
  | 'MONTH_CLOSING'
  | 'BALANCE_LOW'
  | 'LARGE_TRANSACTION'
  | 'INCOME_RECEIVED'
  | 'BUDGET_ALMOST_EXCEEDED'
  | 'BUDGET_EXCEEDED'

/**
 * Something that happened, from GET /notifications (the most recent first). The text is built here from
 * `type` + `data`; the subject is one HAL link (accountConnection, account, transaction or category).
 * Named AppNotification to avoid the DOM Notification.
 */
export interface AppNotification extends HalResource {
  type: NotificationType
  data: {
    /** MONTH_CLOSING: transactions left to categorize; LARGE_TRANSACTION / INCOME_RECEIVED: grouped transactions. */
    count?: number
    /** MONTH_CLOSING, BUDGET_*: "YYYY-MM". */
    month?: string
    /** BALANCE_LOW, LARGE_TRANSACTION, INCOME_RECEIVED: the account (link of the inbox row). */
    accountId?: string
    accountName?: string
    /** Signed decimals, as everywhere in the API. */
    balance?: string
    threshold?: string
    amount?: string
    currency?: string
    /** LARGE_TRANSACTION / INCOME_RECEIVED (one transaction). */
    description?: string
    /** BUDGET_*: system category code (label translated by the front) or user category name. */
    categoryCode?: string | null
    categoryName?: string | null
    spent?: string
    budget?: string
    /** CONNECTION_*: end of the bank access. */
    expiresAt?: string
    /** CONNECTION_*: bank name, written by the API (the service worker can't fetch it). */
    bankName?: string
  } | null
  read: boolean
  readAt: string | null
  createdAt: string
  _links: HalResource['_links'] & {
    accountConnection?: HalLink
    'account-connection'?: HalLink
    account?: HalLink
    transaction?: HalLink
    category?: HalLink
  }
}

/** GET /notification_settings: 0 or 1 item per user. A missing key = the default of the type. */
export interface NotificationSettings extends HalResource {
  /** Push on / off per type (the notification always shows in the inbox). */
  push: Partial<Record<NotificationType, boolean>>
  largeTransactionThreshold?: string | null
  hideAmounts?: boolean
}

/** A device subscribed to Web Push (GET /push_subscriptions); its id is the uuid v5 of `endpoint`. */
export interface PushSubscriptionResource extends HalResource {
  endpoint: string
  locale: string
  /** Set by the API from the request: "Chrome · Android" in the devices list. */
  userAgent: string | null
  createdAt: string
  lastSuccessAt: string | null
}

export type UserActionType =
  | 'CONNECTION_EXPIRED'
  | 'CONNECTION_TO_CONFIGURE'
  | 'CONNECTION_EXPIRING'
  | 'TRANSACTIONS_TO_CATEGORIZE'
  | 'TRANSACTIONS_TO_REVIEW'

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

/** Saving in and out over one month of a saving statement (one per month, even without movement). */
export interface SavingMonth {
  month: string // YYYY-MM
  creditAmount: string
  /** Positive. */
  debitAmount: string
}

/** Saving category (envelope): HAL category link, read with splitCategoryIri(). */
export interface SavingEnvelope {
  category?: string | null | { _links?: { self?: HalLink } }
  _links?: { category?: HalLink }
  /** Total up to the end of the period. */
  amount: string
  /** Net over the period. */
  periodAmount: string
  targetAmount?: string | null
  targetDate?: string | null
}

/** Saving over whole months (GET /savings/{period}). */
export interface SavingStatement extends HalResource {
  period: string
  from: string
  to: string
  months: number
  currency: string
  creditAmount: string
  /** Positive. */
  debitAmount: string
  monthly: SavingMonth[]
  /** Net saving in no envelope ("reste à répartir"). */
  uncategorizedAmount: string
  uncategorizedCount?: number
  /** Every active envelope (0.00 when empty), sorted by amount, highest first. */
  envelopes: SavingEnvelope[]
}
