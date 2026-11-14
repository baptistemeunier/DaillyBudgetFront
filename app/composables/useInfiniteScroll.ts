import type { Ref } from 'vue'

interface InfinitePager {
  hasNextPage: Ref<boolean>
  isFetchingNextPage: Ref<boolean>
  isFetchNextPageError: Ref<boolean>
  fetchNextPage: () => unknown
}

/** Loads the next page when `sentinel` gets ~160 px from the end of `scroller`. */
export function useInfiniteScroll(scroller: Ref<HTMLElement | null>, sentinel: Ref<HTMLElement | null>, pager: InfinitePager) {
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          pager.hasNextPage.value &&
          !pager.isFetchingNextPage.value &&
          !pager.isFetchNextPageError.value
        ) {
          pager.fetchNextPage()
        }
      },
      { root: scroller.value, rootMargin: '0px 0px 160px 0px' },
    )
    if (sentinel.value) observer.observe(sentinel.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  watch(sentinel, (el, old) => {
    if (old) observer?.unobserve(old)
    if (el) observer?.observe(el)
  })

  // A page that doesn't fill the screen leaves the sentinel visible: re-observe
  // so the observer fires again (observe() always reports the current state).
  watch(pager.isFetchingNextPage, (fetching) => {
    if (fetching || !sentinel.value || !observer) return
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  })
}
