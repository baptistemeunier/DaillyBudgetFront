// Callback: checks the state against the PKCE cookie, exchanges the code for tokens.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string; state?: string }>(event)
  const pkce = takePkceCookie(event)

  if (!pkce || typeof body?.state !== 'string' || pkce.state !== body.state) {
    throw createError({ statusCode: 400, statusMessage: 'invalid_state' })
  }
  if (typeof body.code !== 'string' || !body.code) {
    throw createError({ statusCode: 400, statusMessage: 'missing_code' })
  }

  const res = await requestToken(event, {
    grant_type: 'authorization_code',
    code: body.code,
    redirect_uri: pkce.redirectUri,
    code_verifier: pkce.verifier,
  })
  return sendTokens(event, res, { return_to: pkce.returnTo })
})
