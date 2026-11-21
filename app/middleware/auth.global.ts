// No access token -> try the refresh token cookie, then redirect to Authelia. /auth/callback stays public.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/auth/callback') return

  const auth = useAuth()
  if (auth.isAuthenticated.value || (await auth.refresh())) return

  await auth.login(to.fullPath)
  return abortNavigation()
})
