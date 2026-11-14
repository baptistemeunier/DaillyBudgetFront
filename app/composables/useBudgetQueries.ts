import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Budget, BudgetLineInput, HalCollection } from '~/types/api'

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
    onSuccess: (saved) => queryClient.setQueryData(['budget'], saved),
  })
}
