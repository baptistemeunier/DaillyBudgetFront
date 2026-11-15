// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SPA: everything sits behind an OAuth bearer token, SSR brings nothing.
  // Nitro still runs server/ (API proxy + token exchange).
  ssr: false,

  modules: ['@nuxt/fonts', '@nuxtjs/i18n', '@vite-pwa/nuxt'],

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate icon', href: '/favicon.ico', sizes: '32x32' },
      ],
    },
  },

  // Installable from Chrome. Icons come from pwa-assets.config.ts. Only the app shell is cached:
  // /api/** (bank data, OAuth) always goes to the network.
  pwa: {
    registerType: 'autoUpdate',
    pwaAssets: { config: true },
    manifest: {
      name: 'Daily Budget',
      short_name: 'Daily Budget',
      lang: 'fr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#4f46e5',
      background_color: '#f8fafc',
    },
    generateSW: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    },
    // Off in dev: a service worker in front of the Vite dev server breaks module loading
    // (/_nuxt/*.ts fails once the page comes from the worker). Test install on a production build.
    devOptions: { enabled: false },
  },

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
    // Dev server reached through the reverse proxy (budget-test.meunier.ovh, …).
    server: { allowedHosts: ['.meunier.ovh'] },
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
