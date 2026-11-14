import { PERIOD_LENGTHS, type PeriodLength } from '~/utils/period'

export type StatementView = 'expenses' | 'income'

/**
 * Period of the budget screens, kept in the URL (?months=3&to=2026-11&view=income)
 * so back / reload keep it, and carried from one screen to the next with `query`.
 */
export function useStatementPeriod() {
  const route = useRoute()
  const router = useRouter()
  const thisMonth = currentMonth()

  const months = computed<PeriodLength>(() => {
    const n = Number(route.query.months)
    return (PERIOD_LENGTHS as readonly number[]).includes(n) ? (n as PeriodLength) : 1
  })
  const to = computed(() => {
    const q = route.query.to
    return typeof q === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) && q <= thisMonth ? q : thisMonth
  })
  const view = computed<StatementView>(() => (route.query.view === 'income' ? 'income' : 'expenses'))

  /** Query to carry to another budget screen (defaults left out). */
  const query = computed(() => {
    const q: Record<string, string> = {}
    if (months.value !== 1) q.months = String(months.value)
    if (to.value !== thisMonth) q.to = to.value
    if (view.value !== 'expenses') q.view = view.value
    return q
  })

  function setQuery(patch: { months?: number; to?: string; view?: StatementView }) {
    const next = { months: months.value, to: to.value, view: view.value, ...patch }
    const q: Record<string, string> = {}
    if (next.months !== 1) q.months = String(next.months)
    if (next.to !== thisMonth) q.to = next.to
    if (next.view !== 'expenses') q.view = next.view
    router.replace({ query: q })
  }

  function shift(direction: -1 | 1) {
    const next = addMonths(to.value, direction * months.value)
    setQuery({ to: next > thisMonth ? thisMonth : next })
  }

  const canGoNext = computed(() => to.value < thisMonth)
  const period = computed(() => periodOf(to.value, months.value))
  const label = computed(() => periodLabel(to.value, months.value))

  return { months, to, view, query, setQuery, shift, canGoNext, period, label }
}
