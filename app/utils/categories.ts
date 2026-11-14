// Category tree built from GET /categories. The API owns the type and the icon (Lucide name);
// labels of system categories come from the front i18n table, by code.
import { CATEGORY_ORDER, categoryLabel, type CategoryLocale } from '~/i18n/categories'
import type { Component } from 'vue'
import type { AccountType, Category, CategoryType, StatementDetail, Transaction, TransactionSplit } from '~/types/api'

/**
 * Simple / split categorization: income for a credit, expenses for a debit; on a savings / investment
 * account, saving categories only (envelopes). Transfers to another account go through the Transfert tab.
 */
export function allowedTypes(amountCents: number, accountType?: AccountType | null): CategoryType[] {
  if (accountType && accountType !== 'checking') return ['saving']
  return amountCents > 0 ? ['income'] : ['expense']
}

export interface CategoryNode {
  iri: string
  code: string | null
  label: string
  /** Lucide component: the category's icon, else its parent's, else Tag. */
  icon: Component
  /** The category's own icon name (null: none set). */
  iconName: string | null
  type: CategoryType
  parentIri: string | null
  /** "Alimentation › Courses" for children, label for roots. */
  fullLabel: string
  children: CategoryNode[]
  order: number
  /** Envelopes (saving categories) only. */
  targetAmount: string | null
  targetDate: string | null
}

export interface CategoryTree {
  roots: CategoryNode[]
  byIri: Map<string, CategoryNode>
}

const byOrderThenLabel = (a: CategoryNode, b: CategoryNode) =>
  a.order - b.order || a.label.localeCompare(b.label, 'fr')

export function buildCategoryTree(categories: Category[], locale: CategoryLocale = 'fr'): CategoryTree {
  const byIri = new Map<string, CategoryNode>()
  const iriByCode = new Map<string, string>()

  for (const c of categories) {
    const iri = c._links.self.href
    byIri.set(iri, {
      iri,
      code: c.code,
      label: c.name ?? (c.code ? categoryLabel(c.code, locale) : undefined) ?? c.code ?? 'Sans nom',
      icon: categoryIcon(c.icon) ?? DEFAULT_CATEGORY_ICON,
      iconName: c.icon ?? null,
      type: c.type,
      parentIri: c.parent ?? c._links.parent?.href ?? null,
      fullLabel: '',
      children: [],
      order: (c.code ? CATEGORY_ORDER.get(c.code) : undefined) ?? Number.MAX_SAFE_INTEGER,
      targetAmount: c.targetAmount ?? null,
      targetDate: c.targetDate ?? null,
    })
    if (c.code) iriByCode.set(c.code, iri)
  }

  // System categories: parent from the code prefix when the API doesn't give it.
  for (const node of byIri.values()) {
    if (!node.parentIri && node.code?.includes('.')) {
      node.parentIri = iriByCode.get(node.code.split('.')[0]!) ?? null
    }
  }

  const roots: CategoryNode[] = []
  for (const node of byIri.values()) {
    const parent = node.parentIri ? byIri.get(node.parentIri) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  roots.sort(byOrderThenLabel)
  for (const root of roots) {
    root.fullLabel = root.label
    root.children.sort(byOrderThenLabel)
    for (const child of root.children) {
      if (!categoryIcon(child.iconName)) child.icon = root.icon
      child.fullLabel = `${root.label} › ${child.label}`
    }
  }

  return { roots, byIri }
}

/** IRI of a split's category, whatever the HAL rendering. */
export function splitCategoryIri(split: TransactionSplit): string | null {
  if (typeof split.category === 'string') return split.category
  return split.category?._links?.self?.href ?? split._links?.category?.href ?? null
}

/** IRIs of a statement detail, whatever the HAL rendering. */
export function detailIris(detail: StatementDetail): { category: string | null; parent: string | null } {
  const read = (rel: 'category' | 'parent') => {
    const value = detail[rel]
    if (typeof value === 'string') return value
    return value?._links?.self?.href ?? detail._links?.[rel]?.href ?? null
  }
  return { category: read('category'), parent: read('parent') }
}

/** IRI -> id ("/categories/abc" -> "abc"). */
export function iriId(iri: string): string {
  return iri.split('?')[0]!.split('/').filter(Boolean).pop() ?? ''
}

export type CategorizationStatus =
  | { kind: 'none' }
  | { kind: 'partial'; remainingCents: number; main: CategoryNode | null }
  | { kind: 'single'; main: CategoryNode | null }
  | { kind: 'split'; count: number; main: CategoryNode | null }

export function categorizationStatus(t: Transaction, tree: CategoryTree | undefined): CategorizationStatus {
  const splits = t.splits ?? []
  if (!splits.length) return { kind: 'none' }

  const total = splits.reduce((sum, s) => sum + toCents(s.amount), 0)
  const biggest = [...splits].sort((a, b) => Math.abs(toCents(b.amount)) - Math.abs(toCents(a.amount)))[0]!
  const iri = splitCategoryIri(biggest)
  const main = (iri && tree?.byIri.get(iri)) || null

  const remainingCents = toCents(t.amount) - total
  if (remainingCents !== 0) return { kind: 'partial', remainingCents, main }
  if (splits.length === 1) return { kind: 'single', main }
  return { kind: 'split', count: splits.length, main }
}

export interface TransactionRowCategory {
  icon: Component
  label: string
  /** Still something to categorize (nothing or only part of the amount). */
  uncategorized: boolean
}

/** Icon + label shown on a transaction row. */
export function transactionRowCategory(t: Transaction, tree: CategoryTree | undefined): TransactionRowCategory {
  const status = categorizationStatus(t, tree)
  switch (status.kind) {
    case 'none':
      return { icon: UNCATEGORIZED_ICON, label: 'Non catégorisé', uncategorized: true }
    case 'partial':
      return {
        icon: status.main?.icon ?? UNCATEGORIZED_ICON,
        label: `Partiellement catégorisé · ${formatCents(Math.abs(status.remainingCents), t.currency)} restant`,
        uncategorized: true,
      }
    case 'single':
      return { icon: status.main?.icon ?? DEFAULT_CATEGORY_ICON, label: status.main?.label ?? 'Catégorie', uncategorized: false }
    case 'split':
      return { icon: status.main?.icon ?? DEFAULT_CATEGORY_ICON, label: `Ventilé · ${status.count} catégories`, uncategorized: false }
  }
}
