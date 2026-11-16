// OAuth2 Authorization Code + PKCE (S256). Token exchange goes through /api/oauth/token.

interface Tokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: number // epoch ms
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

const TOKENS_KEY = 'auth.tokens'
const PKCE_KEY = 'auth.pkce'
const EXPIRY_MARGIN_MS = 30_000

function storageGet<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function storageSet(storage: () => Storage, key: string, value: unknown) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable: tokens stay in memory only
  }
}

const local = () => window.localStorage
const session = () => window.sessionStorage

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(byteLength = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function pkceChallenge(verifier: string) {
  return base64Url(await sha256(verifier))
}

function redirectUri() {
  return `${window.location.origin}/auth/callback`
}

let refreshing: Promise<string | null> | null = null

export function useAuth() {
  const tokens = useState<Tokens | null>('auth.tokens', () => storageGet<Tokens>(local, TOKENS_KEY))
  const config = useRuntimeConfig().public

  const isAuthenticated = computed(() => tokens.value !== null)

  function saveTokens(res: TokenResponse) {
    tokens.value = {
      accessToken: res.access_token,
      refreshToken: res.refresh_token ?? tokens.value?.refreshToken ?? null,
      expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000,
    }
    storageSet(local, TOKENS_KEY, tokens.value)
  }

  async function login(returnTo = '/') {
    const verifier = randomString(48)
    const state = randomString(16)
    storageSet(session, PKCE_KEY, { verifier, state, returnTo })

    const url = new URL(config.oauthAuthorizeUrl)
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: config.oauthClientId,
      redirect_uri: redirectUri(),
      scope: config.oauthScope,
      state,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: 'S256',
    }).toString()

    window.location.assign(url.toString())
  }

  /** Exchanges the authorization code; returns the path to go back to. */
  async function handleCallback(code: string, state: string): Promise<string> {
    const pkce = storageGet<{ verifier: string; state: string; returnTo: string }>(session, PKCE_KEY)
    storageSet(session, PKCE_KEY, null)

    if (!pkce || pkce.state !== state) throw new Error(i18nT('errors.oauthState'))

    const res = await $fetch<TokenResponse>('/api/oauth/token', {
      method: 'POST',
      body: {
        grant_type: 'authorization_code',
        code,
        code_verifier: pkce.verifier,
        redirect_uri: redirectUri(),
      },
    })
    saveTokens(res)

    return pkce.returnTo.startsWith('/') ? pkce.returnTo : '/'
  }

  async function refresh(): Promise<string | null> {
    const refreshToken = tokens.value?.refreshToken
    // Expired without a way to renew it: forget it, or isAuthenticated stays true and every page
    // (the OAuth callback included) sends back to the login, cutting the code exchange in progress.
    if (!refreshToken) {
      logout()
      return null
    }

    refreshing ??= $fetch<TokenResponse>('/api/oauth/token', {
      method: 'POST',
      body: { grant_type: 'refresh_token', refresh_token: refreshToken },
    })
      .then((res) => {
        saveTokens(res)
        return res.access_token
      })
      .catch(() => {
        logout()
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
    if (!t) return null
    if (t.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return t.accessToken
    return refresh()
  }

  function logout() {
    tokens.value = null
    storageSet(local, TOKENS_KEY, null)
  }

  return { isAuthenticated, login, handleCallback, getAccessToken, refresh, logout }
}
