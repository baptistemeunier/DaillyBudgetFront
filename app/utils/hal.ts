import type { HalCollection, HalResource } from '~/types/api'

export function halItems<T>(collection: HalCollection<T> | undefined): T[] {
  return collection?._embedded?.item ?? []
}

/** Resource id = last path segment of _links.self.href ("/accounts/0193…" -> "0193…"). */
export function halId(resource: HalResource): string {
  const path = resource._links.self.href.split('?')[0] ?? ''
  return path.split('/').filter(Boolean).pop() ?? ''
}
