import type { Account } from '~/types/api'

/** Name shown for an account: its custom display name, else the bank-provided name. */
export function accountName(account: Pick<Account, 'name' | 'displayName'>): string {
  return account.displayName?.trim() || account.name?.trim() || 'Compte sans nom'
}
