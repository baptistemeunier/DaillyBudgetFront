import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Budget, BudgetLineInput, HalCollection, Statement, Transaction } from '~/types/api'

/** The user's budget, or null when none was set yet (GET /budgets returns 0 or 1 item). */
export function useBudgetQuery() {
  const api = useApi()
  return useQuery({
    queryKey: ['budget'],
    queryFn: async () => halItems(await api<HalCollection<Budget>>('/budgets'))[0] ?? null,
  })
}

/** Creates the budget, or replaces its amount and lines (lines are replaced as a whole). */
export function useSaveBudget() {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ budget, amount, lines }: { budget: Budget | null; amount: string; lines: BudgetLineInput[] }) =>
      budget
        ? api<Budget>(budget._links.self.href, {
            method: 'PATCH',
            body: { amount, lines },
            headers: { 'Content-Type': 'application/merge-patch+json' },
          })
        : api<Budget>('/budgets', { method: 'POST', body: { amount, currency: 'EUR', lines } }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['budget'], saved)
      queryClient.invalidateQueries({ queryKey: ['statement'] })
    },
  })
}

/** Statement of a period ("2026-11" or "2026-09..2026-11"); keeps the previous one shown while loading. */
export function useStatementQuery(period: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery({
    queryKey: ['statement', computed(() => toValue(period))],
    queryFn: () => api<Statement>(`/statements/${toValue(period)}`),
    placeholderData: keepPreviousData,
  })
}

/** Transactions with a split on exactly this category, over a period, page by page. */
export function useCategoryTransactionsQuery(categoryId: MaybeRefOrGetter<string>, period: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useInfiniteQuery({
    // Under 'transactions': patched by useUpdateSplits like the other lists
    queryKey: ['transactions', 'category', computed(() => toValue(categoryId)), computed(() => toValue(period))],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      if (pageParam) return api<HalCollection<Transaction>>(pageParam)
      const { after, strictlyBefore } = periodBounds(toValue(period))
      const query = new URLSearchParams({
        category: toValue(categoryId),
        'bookingAt[after]': after,
        'bookingAt[strictly_before]': strictlyBefore,
        page: '1',
      })
      return api<HalCollection<Transaction>>(`/transactions?${query}`)
    },
    getNextPageParam: (last) => last._links.next?.href,
  })
}
