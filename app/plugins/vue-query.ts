import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

export default defineNuxtPlugin({
  // Named: push.client.ts depends on it (it runs after, alphabetically it would run before).
  name: 'vue-query',
  setup(nuxtApp) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 1,
        },
      },
    })

    nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
  },
})
