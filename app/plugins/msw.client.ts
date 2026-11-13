// Starts the MSW service worker before the app mounts when NUXT_PUBLIC_API_MOCKING=true.
export default defineNuxtPlugin({
  name: 'msw',
  enforce: 'pre',
  async setup() {
    const { apiMocking } = useRuntimeConfig().public
    if (!apiMocking) return

    const { setupWorker } = await import('msw/browser')
    const { handlers } = await import('~/mocks/handlers')

    await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass' })
  },
})
