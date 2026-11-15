// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SPA: everything sits behind an OAuth bearer token, SSR brings nothing.
  // Nitro still runs server/ (API proxy + token exchange).
  ssr: false,

  modules: ['@nuxt/fonts', '@nuxtjs/i18n'],

  fonts: {
    families: [{ name: 'Inter', weights: [400, 500, 600, 700] }],
  },

  // UI messages in app/i18n/locales; no locale prefix in URLs (SPA behind OAuth). The choice is kept
  // in a cookie, the browser language decides on first visit.
  i18n: {
    restructureDir: 'app/i18n',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'fr',
    },
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
      oauthScope: 'account_connection:write account:write category:write budget:write',
      apiMocking: false,
    },
  },
})
