import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/vue-query'
import type { Account, AccountConnection, Bank, Category, HalCollection, Transaction, UserAction } from '~/types/api'

export function useConnectionsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['account_connections'],
    queryFn: async () => halItems(await api<HalCollection<AccountConnection>>('/account_connections')),
  })
}

/** What the user has to do (expired banks, transactions to categorize…), highest priority first. */
export function useUserActionsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['user_actions'],
    queryFn: async () => halItems(await api<HalCollection<UserAction>>('/user_actions')),
  })
}

/** Accounts of one connection, fetched through its HAL `accounts` link. */
export function useAccountsQuery(href: MaybeRefOrGetter<string | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: ['accounts', computed(() => toValue(href))],
    queryFn: async () => halItems(await api<HalCollection<Account>>(toValue(href)!)),
    enabled: computed(() => !!toValue(href)),
    // Poll every 3 s while an account is syncing, stop once SUCCESS / FAILED.
    refetchInterval: (query) =>
      query.state.data?.some((a) => a.synchronizedStatus === 'PENDING' || a.synchronizedStatus === 'IN_PROGRESS')
        ? 3000
        : false,
  })
}

/** Bank through its HAL link. Banks barely change: cached for the session. */
export function useBankQuery(href: MaybeRefOrGetter<string | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: ['bank', computed(() => toValue(href))],
    queryFn: () => api<Bank>(toValue(href)!),
    enabled: computed(() => !!toValue(href)),
    staleTime: Infinity,
  })
}

/**
 * Every item of a paginated collection: read page 1 for totalItems / itemsPerPage,
 * then load the remaining pages in parallel. Deduped on _links.self.
 */
async function fetchAllPages<T extends { _links: { self: { href: string } } }>(
  api: ReturnType<typeof useApi>,
  path: string,
  query: Record<string, string> = {},
): Promise<T[]> {
  const first = await api<HalCollection<T>>(path, { query: { ...query, page: 1 } })
  const perPage = first.itemsPerPage || halItems(first).length || 1
  const pages = Math.ceil((first.totalItems ?? 0) / perPage)

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      api<HalCollection<T>>(path, { query: { ...query, page: i + 2 } }),
    ),
  )

  const seen = new Set<string>()
  return [first, ...rest]
    .flatMap((p) => halItems(p))
    .filter((item) => !seen.has(item._links.self.href) && seen.add(item._links.self.href))
}

/** Every bank of a country, sorted by name. */
export function useBanksQuery(country: MaybeRefOrGetter<string | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: ['banks', computed(() => toValue(country))],
    enabled: computed(() => !!toValue(country)),
    staleTime: 20 * 60_000,
    queryFn: async () =>
      (await fetchAllPages<Bank>(api, '/banks', { country: toValue(country)! })).sort((a, b) =>
        a.name.localeCompare(b.name, 'fr'),
      ),
  })
}

/** All the user's accounts (the API scopes /accounts to the current user). */
export function useAllAccountsQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => fetchAllPages<Account>(api, '/accounts'),
  })
}

/** Creates the GoCardless requisition; the caller redirects to _links.configure. */
export function useCreateConnection() {
  const api = useApi()
  return useMutation({
    mutationFn: (bankId: string) =>
      api<AccountConnection>('/account_connections', {
        method: 'POST',
        body: { bankId, redirectUri: `${window.location.origin}/banks/callback` },
      }),
  })
}

/** Expired access can't be renewed: start a new connection to the same bank and go to its consent page. */
export function useReconnectBank() {
  const create = useCreateConnection()
  async function start(bankId: string) {
    if (create.isPending.value) return
    try {
      const connection = await create.mutateAsync(bankId)
      const href = connection._links.configure?.href
      if (!href) throw new Error('Lien de consentement absent')
      window.location.assign(href)
    } catch {
      // isError drives the caller's message
    }
  }
  return { start, isPending: create.isPending, isError: create.isError }
}

export function useSyncConnection() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (connectionId: string) =>
      api<AccountConnection>(`/account_connections/${connectionId}/sync`, {
        method: 'PATCH',
        body: {},
        headers: { 'Content-Type': 'application/merge-patch+json' },
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['account_connections'] })
      queryClient.invalidateQueries({ queryKey: ['user_actions'] })
    },
  })
}

export function useDeleteConnection() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (connection: AccountConnection) => api(connection._links.self.href, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account_connections'] })
      queryClient.invalidateQueries({ queryKey: ['user_actions'] })
    },
  })
}

const isSyncing = (a: Account | undefined) =>
  a?.synchronizedStatus === 'PENDING' || a?.synchronizedStatus === 'IN_PROGRESS'

/** One account; polled every 3 s while its sync is running. */
export function useAccountQuery(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery({
    queryKey: ['account', computed(() => toValue(id))],
    queryFn: () => api<Account>(`/accounts/${toValue(id)}`),
    refetchInterval: (query) => (isSyncing(query.state.data) ? 3000 : false),
  })
}

/** Transactions, page by page, following HAL `_links.next`. */
export function useTransactionsQuery(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: ['transactions', computed(() => toValue(id))],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<HalCollection<Transaction>>(pageParam || `/accounts/${toValue(id)}/transactions?page=1`),
    getNextPageParam: (last) => last._links.next?.href,
  })
}

/** System + user categories, as a tree (labels from app/i18n, emojis from app/utils/categoryEmojis.ts). */
export function useCategoriesQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['categories'],
    staleTime: 10 * 60_000,
    queryFn: async () => buildCategoryTree(await fetchAllPages<Category>(api, '/categories')),
  })
}

export interface SplitInput {
  category: string // IRI
  amount: string // signed decimal, same sign as the transaction
}

/** Replaces the splits of a transaction and patches it in the account's transaction list. */
export function useUpdateSplits(accountId: MaybeRefOrGetter<string>) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ transaction, splits }: { transaction: Transaction; splits: SplitInput[] }) =>
      api<Transaction>(transaction._links.self.href, {
        method: 'PATCH',
        body: { splits },
        headers: { 'Content-Type': 'application/merge-patch+json' },
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['user_actions'] })
      queryClient.setQueryData<InfiniteData<HalCollection<Transaction>>>(
        ['transactions', toValue(accountId)],
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              _embedded: page._embedded && {
                ...page._embedded,
                item: page._embedded.item?.map((t) =>
                  t._links.self.href === updated._links.self.href ? { ...t, ...updated } : t,
                ),
              },
            })),
          },
      )
    },
  })
}

/** Creates a user sub-category under a root; resolves once the category tree includes it. */
export function useCreateCategory() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, parent }: { name: string; parent: string }) =>
      api<Category>('/categories', { method: 'POST', body: { name, parent } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
}
