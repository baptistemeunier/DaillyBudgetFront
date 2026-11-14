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
