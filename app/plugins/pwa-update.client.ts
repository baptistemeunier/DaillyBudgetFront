// Applies a new service worker (registerType 'prompt'), but never on a callback page: the reload that
// follows would cut the OAuth code exchange (/auth/callback) or the bank sync (/banks/callback).
// Outside of them, the update is applied at once, as autoUpdate did.
const CALLBACKS = ['/auth/callback', '/banks/callback']

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  nuxtApp.hook('app:mounted', () => {
    const pwa = nuxtApp.$pwa as { needRefresh: boolean; updateServiceWorker: (reload?: boolean) => Promise<void> } | undefined
    if (!pwa) return

    const applyIfSafe = () => {
      if (pwa.needRefresh && !CALLBACKS.includes(router.currentRoute.value.path)) pwa.updateServiceWorker(true)
    }
    watch(() => pwa.needRefresh, applyIfSafe)
    router.afterEach(applyIfSafe)
  })
})
