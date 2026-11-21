// OAuth2 Authorization Code + PKCE (S256) against Authelia, run by the Nitro server (server/api/auth/*):
// it keeps the PKCE verifier and the refresh token in httpOnly cookies. The browser only keeps the
// short-lived access token, and asks /api/auth/refresh for a new one (cookie) when it expires.

interface Tokens {
  accessToken: string
  expiresAt: number // epoch ms
}

interface TokenResponse {
  access_token: string
  expires_in: number
}

const TOKENS_KEY = 'auth.access'
// Before Authelia, the refresh token was kept here: drop it.
const LEGACY_TOKENS_KEY = 'auth.tokens'
const EXPIRY_MARGIN_MS = 30_000

function loadTokens(): Tokens | null {
  try {
    localStorage.removeItem(LEGACY_TOKENS_KEY)
    const raw = localStorage.getItem(TOKENS_KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}

function storeTokens(value: Tokens | null) {
  try {
    if (value === null) localStorage.removeItem(TOKENS_KEY)
    else localStorage.setItem(TOKENS_KEY, JSON.stringify(value))
  } catch {
    // storage unavailable: the token stays in memory only
  }
}

let refreshing: Promise<string | null> | null = null

export function useAuth() {
  const tokens = useState<Tokens | null>('auth.tokens', loadTokens)
  const config = useRuntimeConfig().public

  const isAuthenticated = computed(() => tokens.value !== null)

  function saveTokens(res: TokenResponse) {
    tokens.value = { accessToken: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 }
    storeTokens(tokens.value)
  }

  /** Forgets the access token in this browser (the refresh token cookie is left alone). */
  function clearSession() {
    tokens.value = null
    storeTokens(null)
  }

  async function login(returnTo = '/') {
    const { url } = await $fetch<{ url: string }>('/api/auth/login', {
      method: 'POST',
      body: { redirectUri: `${window.location.origin}/auth/callback`, returnTo },
    })
    window.location.assign(url)
  }

  /** Exchanges the authorization code; returns the path to go back to. */
  async function handleCallback(code: string, state: string): Promise<string> {
    let res: TokenResponse & { return_to: string }
    try {
      res = await $fetch<TokenResponse & { return_to: string }>('/api/auth/callback', { method: 'POST', body: { code, state } })
    } catch (e) {
      const invalidState = (e as { statusMessage?: string }).statusMessage === 'invalid_state'
      throw new Error(i18nT(invalidState ? 'errors.oauthState' : 'auth.failed'))
    }
    saveTokens(res)
    return res.return_to
  }

  /** New access token from the refresh token cookie, or null if the user must log in again. */
  async function refresh(): Promise<string | null> {
    refreshing ??= $fetch<TokenResponse>('/api/auth/refresh', { method: 'POST' })
      .then((res) => {
        saveTokens(res)
        return res.access_token
      })
      .catch(() => {
        // Forget the token, or isAuthenticated stays true and every page (the OAuth callback
        // included) sends back to the login, cutting the code exchange in progress.
        clearSession()
        return null
      })
      .finally(() => {
        refreshing = null
      })

    return refreshing
  }

  /** Valid access token (refreshed if needed), or null if the user must log in again. */
  async function getAccessToken(): Promise<string | null> {
    const t = tokens.value
    if (t && t.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return t.accessToken
    return refresh()
  }

  /** Ends the session: revokes the refresh token, then closes the Authelia session. */
  async function logout() {
    clearSession()
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // The cookie may still be there, Authelia's logout below closes the session anyway
    }
    window.location.assign(config.oauthLogoutUrl)
  }

  return { isAuthenticated, login, handleCallback, getAccessToken, refresh, clearSession, logout }
}
