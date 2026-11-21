// OAuth2 against Authelia, public client (no secret) + PKCE S256. The Nitro server holds the PKCE
// verifier and the refresh token in httpOnly cookies: the browser only ever sees the access token.
import type { H3Event } from 'h3'

export const PKCE_COOKIE = 'auth_pkce'
export const REFRESH_COOKIE = 'auth_rt'

const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/api/auth',
} as const

export interface PkceCookie {
  verifier: string
  state: string
  redirectUri: string
  returnTo: string
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

export function setPkceCookie(event: H3Event, value: PkceCookie) {
  setCookie(event, PKCE_COOKIE, JSON.stringify(value), { ...COOKIE_BASE, maxAge: 10 * 60 })
}

/** Reads and deletes the PKCE cookie (single use). */
export function takePkceCookie(event: H3Event): PkceCookie | null {
  const raw = getCookie(event, PKCE_COOKIE)
  deleteCookie(event, PKCE_COOKIE, COOKIE_BASE)
  try {
    return raw ? (JSON.parse(raw) as PkceCookie) : null
  } catch {
    return null
  }
}

export function getRefreshToken(event: H3Event) {
  return getCookie(event, REFRESH_COOKIE) ?? null
}

// Authelia decides how long the refresh token stays valid; the cookie just has to outlive it.
export function setRefreshToken(event: H3Event, token: string) {
  setCookie(event, REFRESH_COOKIE, token, { ...COOKIE_BASE, maxAge: 90 * 24 * 3600 })
}

export function clearRefreshToken(event: H3Event) {
  deleteCookie(event, REFRESH_COOKIE, COOKIE_BASE)
}

/** POST application/x-www-form-urlencoded to the token endpoint, with client_id only (public client). */
export async function requestToken(event: H3Event, grant: Record<string, string>): Promise<TokenResponse> {
  const config = useRuntimeConfig(event)
  const body = new URLSearchParams({ ...grant, client_id: config.public.oauthClientId })

  let res: Response
  try {
    res = await fetch(config.oauthTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    })
  } catch (e) {
    console.error('[auth] cannot reach', config.oauthTokenUrl, e)
    throw createError({ statusCode: 502, statusMessage: 'token_endpoint_unreachable' })
  }

  const text = await res.text()
  if (!res.ok) {
    console.error('[auth] token endpoint', res.status, grant.grant_type, text.slice(0, 2000))
    // 400 invalid_grant / 401 invalid_client: the session is over, the user must log in again.
    throw createError({ statusCode: res.status >= 500 ? 502 : 401, statusMessage: 'token_request_failed' })
  }
  return JSON.parse(text) as TokenResponse
}

/** Keeps the refresh token server side, hands the access token to the browser. */
export function sendTokens(event: H3Event, res: TokenResponse, extra: Record<string, unknown> = {}) {
  if (res.refresh_token) setRefreshToken(event, res.refresh_token)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { access_token: res.access_token, expires_in: res.expires_in ?? 3600, ...extra }
}
