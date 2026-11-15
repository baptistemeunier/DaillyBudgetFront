import type { Account, AccountType } from '~/types/api'

/** Name shown for an account: its custom display name, else the bank-provided name. */
export function accountName(account: Pick<Account, 'name' | 'displayName'>): string {
  return account.displayName?.trim() || account.name?.trim() || i18nT('accounts.unnamed')
}

export function accountTypeLabel(type: AccountType): string {
  return i18nT(`accounts.type.${type}`)
}

/** Currencies accepted by the API (App\Enum\Currency). */
export const CURRENCIES = [
  { code: 'EUR', label: 'EUR €' },
  { code: 'PHP', label: 'PHP ₱' },
] as const

/** Group of accounts a list can be limited to: checking (budget) or savings + investment (savings). */
export type AccountScope = 'checking' | 'savings'

export const ACCOUNT_SCOPES: Record<AccountScope, { types: AccountType[] }> = {
  checking: { types: ['checking'] },
  savings: { types: ['savings', 'investment'] },
}

export function accountScopeLabel(scope: AccountScope): string {
  return i18nT(`accounts.scope.${scope}`)
}

export function isAccountScope(value: unknown): value is AccountScope {
  return value === 'checking' || value === 'savings'
}
