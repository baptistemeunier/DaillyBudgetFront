import type { InfiniteData } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import type { HalCollection, Transaction } from '~/types/api'

export interface DayGroup {
  key: string
  label: string
  totals: string
  items: Transaction[]
}

/** Merges the pages first (a day can be split across two pages), dedupes, then groups by Paris day. */
export function useDayGroups(pages: Ref<InfiniteData<HalCollection<Transaction>> | undefined>) {
  return computed<DayGroup[]>(() => {
    const seen = new Set<string>()
    const byDay = new Map<string, Transaction[]>()

    for (const page of pages.value?.pages ?? []) {
      for (const t of halItems(page)) {
        if (seen.has(t._links.self.href)) continue
        seen.add(t._links.self.href)
        const key = t.bookingAt ? dayKey(t.bookingAt) : 'unknown'
        if (!byDay.has(key)) byDay.set(key, [])
        byDay.get(key)!.push(t)
      }
    }

    return [...byDay.entries()].map(([key, items]) => {
      // One total per currency (usually just one).
      const sums = new Map<string, number>()
      for (const t of items) sums.set(t.currency, (sums.get(t.currency) ?? 0) + toCents(t.amount))
      return {
        key,
        label: key === 'unknown' ? 'Date inconnue' : dayLabel(key),
        totals: [...sums].map(([cur, cents]) => formatSignedCents(cents, cur)).join(' · '),
        items,
      }
    })
  })
}
