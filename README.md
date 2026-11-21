# Daily Budget

Personal budget web app: accounts overview, transaction categorization, monthly budget and savings tracking, push notifications.

The app uses the [Daily Budget API](../dailyBudget).

## Features

- **Overview**: balances of all accounts and the actions waiting for you (transactions to categorize or review, bank connections to renew).
- **Banks**: connect a bank, manage your connections, and create manual savings or investment accounts.
- **Transactions**: categorize transactions (including split ones), review those categorized automatically, hide a transaction from the budget, and manage categories and rules.
- **Budget**: plan the month by category, then follow what has been spent in each one.
- **Savings**: see the money set aside in each savings envelope.
- **Notifications**: an inbox and Web Push alerts, with settings for each alert type.
- **Installable PWA**, available in French and English.

## Stack

- Nuxt 4 as a SPA (no SSR) and Vue 3
- Tailwind CSS 4, Lucide icons
- TanStack Vue Query for API data
- `@nuxtjs/i18n` (fr, en)
- `@vite-pwa/nuxt` with a custom service worker (`service-worker/sw.ts`) that handles Web Push
- MSW for API mocking

The Nitro server (`server/`) does two things: it proxies `/api/**` to the API, and it runs the OAuth login against Authelia (`server/api/auth/*`): authorization code with PKCE S256, as a public client with no secret. The PKCE verifier and the refresh token stay in httpOnly cookies; the browser only keeps the access token, which it sends to the API as `Authorization: Bearer`.

Authelia must list the exact callback URL (`https://<front host>/auth/callback`) in the `redirect_uris` of the `dailybudget` client.

## Getting started

```bash
npm install
cp .env.example .env    # then fill in the values below
npm run dev             # http://localhost:3000
```

### Configuration

| Variable | Purpose |
|---|---|
| `NUXT_API_BASE_URL` | API URL (server only) |
| `NUXT_OAUTH_TOKEN_URL` | Authelia token endpoint (server only) |
| `NUXT_OAUTH_REVOCATION_URL` | Authelia revocation endpoint, used on logout (server only) |
| `NUXT_PUBLIC_OAUTH_CLIENT_ID` | OAuth client id (`dailybudget`) |
| `NUXT_PUBLIC_OAUTH_AUTHORIZE_URL` | Authelia authorization endpoint |
| `NUXT_PUBLIC_OAUTH_LOGOUT_URL` | Authelia portal logout, opened after sign-out |
| `NUXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key of the API (Web Push) |
| `NUXT_PUBLIC_API_MOCKING` | `true` to use the mocked API (MSW) instead of the real one |

The service worker is turned off in dev. To test installing the app or push notifications, use a production build:

```bash
npm run build && npm run preview
```

## Deployment

The `Dockerfile` builds a self-contained Node image that serves the app on port 3000. The production stack, with the API and the database, lives in the API repository (`compose.prod.yaml`, `bin/release.sh`).
