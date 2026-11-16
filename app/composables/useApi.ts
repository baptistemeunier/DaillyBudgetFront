// $fetch bound to the /api proxy: adds the Bearer token, asks for HAL,
// retries once after a refresh on 401, then sends the user back to login.
export function useApi() {
  const auth = useAuth()
  const router = useRouter()

  // Never from the OAuth callback: the redirection would cut the code exchange in progress.
  async function relogin() {
    const current = router.currentRoute.value
    if (current.path !== '/auth/callback') await auth.login(current.fullPath)
  }

  async function api<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}, retried = false): Promise<T> {
    const token = await auth.getAccessToken()
    if (!token) {
      await relogin()
      throw new Error(i18nT('errors.sessionExpired'))
    }

    try {
      return await $fetch<T>(path, {
        baseURL: '/api',
        ...opts,
        headers: {
          Accept: 'application/hal+json',
          ...(opts.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`,
        },
      })
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 401 && !retried && (await auth.refresh())) {
        return api<T>(path, opts, true)
      }
      if (status === 401) {
        auth.logout()
        await relogin()
      }
      throw err
    }
  }

  return api
}
