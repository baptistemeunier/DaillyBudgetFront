// Web Push, app side (the service worker is service-worker/sw.ts):
// - saves this device's subscription again at each opening and language change (usePushDevice().resync());
// - ?notification={id}, added by a click on a push: marks that notification read, then drops the parameter.
import { useQueryClient } from '@tanstack/vue-query'
import type { Composer } from 'vue-i18n'

export default defineNuxtPlugin({
  name: 'push',
  dependsOn: ['vue-query', 'i18n-bridge'],
  setup(nuxtApp) {
    const auth = useAuth()
    const api = useApi()
    const router = useRouter()
    const { push, queryClient } = nuxtApp.vueApp.runWithContext(() => ({
      push: usePushDevice(),
      queryClient: useQueryClient(),
    }))

    // Only once logged in: the API calls would otherwise send to the login page.
    const resync = () => {
      if (auth.isAuthenticated.value) push.resync()
    }
    nuxtApp.hook('app:mounted', resync)
    watch(auth.isAuthenticated, resync)
    watch((nuxtApp.$i18n as unknown as Composer).locale, resync)

    // The initial navigation may be seen by both isReady() and afterEach: each id is handled once.
    const handled = new Set<string>()
    async function markOpened(id: unknown) {
      if (typeof id !== 'string' || handled.has(id) || !auth.isAuthenticated.value) return
      handled.add(id)
      const { notification: _, ...query } = router.currentRoute.value.query
      await router.replace({ query })
      try {
        await api(`/notifications/${id}`, {
          method: 'PATCH',
          body: { read: true },
          headers: { 'Content-Type': 'application/merge-patch+json' },
        })
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      } catch {
        // Stays unread: the user can still open it from the inbox
      }
    }
    router.isReady().then(() => markOpened(router.currentRoute.value.query.notification))
    router.afterEach((to) => markOpened(to.query.notification))
  },
})
