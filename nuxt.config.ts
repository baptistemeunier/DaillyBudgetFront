// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
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
  // buildSW (vite-pwa v2): our own TypeScript service worker (service-worker/sw.ts), bundled to sw.js,
  // precaches the shell and handles Web Push.
  pwa: {
    strategies: 'buildSW',
    // 'prompt': no automatic reload when a new worker is ready — it could cut the OAuth code exchange.
    // app/plugins/pwa-update.client.ts applies the update outside the auth / bank callbacks.
    registerType: 'prompt',
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
    // The navigation fallback ('/', except /api/) is in sw.ts. '/' must be precached for it, but this SPA has
    // no index.html in .output/public (Nitro serves the shell): added by hand, with a new revision per build.
    additionalManifestEntries: [{ url: '/', revision: String(Date.now()) }],
    buildSW: {
      swSrc: fileURLToPath(new URL('./service-worker/sw.ts', import.meta.url)),
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
    // Server only — overridden by NUXT_API_BASE_URL, NUXT_OAUTH_TOKEN_URL, NUXT_OAUTH_REVOCATION_URL
    apiBaseUrl: 'http://192.168.50.12:8000',
    // Authelia, public client (PKCE, no secret): see server/api/auth
    oauthTokenUrl: 'https://auth.home.meunier.ovh/api/oidc/token',
    oauthRevocationUrl: 'https://auth.home.meunier.ovh/api/oidc/revocation',

    public: {
      // Overridden by NUXT_PUBLIC_*
      oauthClientId: 'dailybudget',
      // Web Push: public VAPID key of the API (not a secret), base64url — NUXT_PUBLIC_VAPID_PUBLIC_KEY
      vapidPublicKey: '',
      oauthAuthorizeUrl: 'https://auth.home.meunier.ovh/api/oidc/authorization',
      // Authelia portal logout, after the refresh token is revoked — NUXT_PUBLIC_OAUTH_LOGOUT_URL
      oauthLogoutUrl: 'https://auth.home.meunier.ovh/logout',
      // offline_access: without it, Authelia delivers no refresh token
      oauthScope: 'openid offline_access account_connection:write account:write category:write budget:write',
      apiMocking: false,
    },
  },
})
