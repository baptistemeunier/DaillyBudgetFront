// Logout: drops the refresh token cookie and revokes the token at Authelia (best effort).
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const refreshToken = getRefreshToken(event)
  clearRefreshToken(event)

  if (refreshToken) {
    try {
      const res = await fetch(config.oauthRevocationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: 'refresh_token',
          client_id: config.public.oauthClientId,
        }),
      })
      if (!res.ok) console.error('[auth] revocation', res.status, (await res.text()).slice(0, 2000))
    } catch (e) {
      console.error('[auth] cannot reach', config.oauthRevocationUrl, e)
    }
  }

  setResponseStatus(event, 204)
  return null
})
