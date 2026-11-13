// Token exchange: the browser sends the PKCE code (or a refresh token),
// the server adds client_id / client_secret so the secret never reaches the browser.
const ALLOWED_GRANTS = ['authorization_code', 'refresh_token'] as const

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody<Record<string, string>>(event)

  if (!ALLOWED_GRANTS.includes(body?.grant_type as (typeof ALLOWED_GRANTS)[number])) {
    throw createError({ statusCode: 400, statusMessage: 'unsupported_grant_type' })
  }

  const params = new URLSearchParams({
    grant_type: body.grant_type,
    client_id: config.public.oauthClientId,
  })
  if (config.oauthClientSecret) params.set('client_secret', config.oauthClientSecret)

  if (body.grant_type === 'authorization_code') {
    params.set('code', body.code ?? '')
    params.set('code_verifier', body.code_verifier ?? '')
    params.set('redirect_uri', body.redirect_uri ?? '')
  } else {
    params.set('refresh_token', body.refresh_token ?? '')
  }

  let res: Response
  try {
    res = await fetch(config.oauthTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params,
    })
  } catch (e) {
    console.error('[oauth/token] cannot reach', config.oauthTokenUrl, e)
    throw createError({ statusCode: 502, statusMessage: 'token_endpoint_unreachable' })
  }

  const text = await res.text()
  if (!res.ok) {
    console.error('[oauth/token] upstream', res.status, config.oauthTokenUrl, text.slice(0, 2000))
  }

  setResponseStatus(event, res.status)
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return text
})
