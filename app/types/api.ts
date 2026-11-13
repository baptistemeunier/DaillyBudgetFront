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
  iban: string | null
  externalId: string
  externalStatus: string | null
  externalUpdatedAt: string | null
  synchronizedStatus: AccountSyncStatus | null
  synchronizedAt: string | null
  // Not exposed by the API yet (handoff §6.1)
  balanceAmount?: string | null
  balanceCurrency?: string | null
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
  // Not exposed by the API yet (handoff §6.2)
  category?: string | null
}

export interface Bank extends HalResource {
  id: string
  name: string
  logo: string | null
  countries: string[]
}
