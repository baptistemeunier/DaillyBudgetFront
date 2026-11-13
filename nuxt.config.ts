// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SPA: everything sits behind an OAuth bearer token, SSR brings nothing.
  // Nitro still runs server/ (API proxy + token exchange).
  ssr: false,

  modules: ['@nuxt/fonts'],

  fonts: {
    families: [{ name: 'Inter', weights: [400, 500, 600, 700] }],
  },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    // Server only — overridden by NUXT_API_BASE_URL, NUXT_OAUTH_TOKEN_URL, NUXT_OAUTH_CLIENT_SECRET
    apiBaseUrl: 'http://192.168.50.12:8000',
    oauthTokenUrl: 'http://192.168.50.12:8000/oauth/token',
    oauthClientSecret: '',

    public: {
      // Overridden by NUXT_PUBLIC_*
      oauthClientId: '',
      oauthAuthorizeUrl: 'https://auth.meunier.ovh/oauth/authorize',
      oauthScope: 'account_connection:write account:write category:write',
      apiMocking: false,
    },
  },
})
