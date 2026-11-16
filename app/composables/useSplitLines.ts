// Split lines (category + positive amount typed by the user) shared by Ventiler and the
// several-envelopes transfer: a partial split is allowed, never more than the amount, each category once.
import type { SplitInput } from '~/composables/useBankingQueries'

export interface SplitLine {
  key: number
  category: string | null
  /** Positive amount typed by the user ("12,50"). */
  input: string
}

export function useSplitLines(absAmount: MaybeRefOrGetter<number>) {
  const i18n = useI18n()
  const lines = ref<SplitLine[]>([])
  /** Index of the line choosing its category. */
  const picking = ref<number | null>(null)
  let nextKey = 0

  const allocated = computed(() => lines.value.reduce((sum, l) => sum + (parseAmountInput(l.input) ?? 0), 0))
  const remaining = computed(() => toValue(absAmount) - allocated.value)
  const usedIris = computed(() => lines.value.map((l) => l.category).filter((c): c is string => !!c))

  const lineErrors = computed(() =>
    lines.value.map((l) => {
      const cents = parseAmountInput(l.input)
      if (!l.category) return i18n.t('categorize.chooseCategoryError')
      if (cents === null || cents === 0) return i18n.t('common.invalidAmount')
      return null
    }),
  )

  const isValid = computed(
    () =>
      remaining.value >= 0 &&
      lineErrors.value.every((e) => e === null) &&
      new Set(usedIris.value).size === usedIris.value.length,
  )

  /** (Re)starts from these (category, cents) pairs. */
  function reset(from: { category: string | null; cents: number }[] = []) {
    picking.value = null
    lines.value = from.map((l) => ({ key: nextKey++, category: l.category, input: centsToInput(Math.abs(l.cents), true) }))
  }

  /** New line with what's left, and its category picker opened. */
  function addLine() {
    lines.value.push({ key: nextKey++, category: null, input: remaining.value > 0 ? centsToInput(remaining.value, true) : '' })
    picking.value = lines.value.length - 1
  }

  function removeLine(index: number) {
    lines.value.splice(index, 1)
  }

  function pickForLine(iri: string) {
    if (picking.value === null) return
    lines.value[picking.value]!.category = iri
    picking.value = null
  }

  /** Splits to send, amounts signed like the transaction (`sign` = -1 for a debit). */
  function toSplits(sign: number, extra: Partial<SplitInput> = {}): SplitInput[] {
    return lines.value.map((l) => ({
      category: l.category!,
      amount: centsToDecimal(sign * (parseAmountInput(l.input) ?? 0)),
      ...extra,
    }))
  }

  return { lines, picking, remaining, usedIris, lineErrors, isValid, reset, addLine, removeLine, pickForLine, toSplits }
}
