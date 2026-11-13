// No token -> redirect to the OAuth server. /auth/callback stays public.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/auth/callback') return

  const auth = useAuth()
  if (auth.isAuthenticated.value) return

  await auth.login(to.fullPath)
  return abortNavigation()
})
