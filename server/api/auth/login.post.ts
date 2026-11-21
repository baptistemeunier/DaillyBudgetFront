// Starts the login: keeps the PKCE verifier and the state in an httpOnly cookie, returns the Authelia
// authorization URL. The browser sends its callback URL (it knows its own origin behind the reverse proxy);
// Authelia only accepts the exact URLs listed in the client's redirect_uris.
import { createHash, randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody<{ redirectUri?: string; returnTo?: string }>(event)

  let redirectUri: URL
  try {
    redirectUri = new URL(body?.redirectUri ?? '')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'invalid_redirect_uri' })
  }
  if (redirectUri.pathname !== '/auth/callback') {
    throw createError({ statusCode: 400, statusMessage: 'invalid_redirect_uri' })
  }

  const verifier = randomBytes(48).toString('base64url') // 64 characters
  const state = randomBytes(16).toString('base64url')
  const returnTo = typeof body?.returnTo === 'string' && body.returnTo.startsWith('/') && !body.returnTo.startsWith('//') ? body.returnTo : '/'
  setPkceCookie(event, { verifier, state, redirectUri: redirectUri.href, returnTo })

  const url = new URL(config.public.oauthAuthorizeUrl)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.public.oauthClientId,
    redirect_uri: redirectUri.href,
    scope: config.public.oauthScope,
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString()

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { url: url.href }
})
