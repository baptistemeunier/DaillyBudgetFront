// New access token from the refresh token cookie. Authelia rotates the refresh token: the cookie is replaced.
export default defineEventHandler(async (event) => {
  const refreshToken = getRefreshToken(event)
  if (!refreshToken) throw createError({ statusCode: 401, statusMessage: 'no_session' })

  try {
    const res = await requestToken(event, { grant_type: 'refresh_token', refresh_token: refreshToken })
    return sendTokens(event, res)
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 401) clearRefreshToken(event)
    throw e
  }
})
