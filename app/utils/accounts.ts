import type { Account, AccountType } from '~/types/api'

/** Name shown for an account: its custom display name, else the bank-provided name. */
export function accountName(account: Pick<Account, 'name' | 'displayName'>): string {
  return account.displayName?.trim() || account.name?.trim() || 'Compte sans nom'
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Courant',
  savings: 'Épargne',
  investment: 'Investissement',
}

/** Currencies accepted by the API (App\Enum\Currency). */
export const CURRENCIES = [
  { code: 'EUR', label: 'EUR €' },
  { code: 'PHP', label: 'PHP ₱' },
] as const

/** Group of accounts a list can be limited to: checking (budget) or savings + investment (savings). */
export type AccountScope = 'checking' | 'savings'

export const ACCOUNT_SCOPES: Record<AccountScope, { types: AccountType[]; label: string }> = {
  checking: { types: ['checking'], label: 'Comptes courants' },
  savings: { types: ['savings', 'investment'], label: "Comptes d'épargne" },
}

export function isAccountScope(value: unknown): value is AccountScope {
  return value === 'checking' || value === 'savings'
}
