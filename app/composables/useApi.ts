// $fetch bound to the /api proxy: adds the Bearer token, asks for HAL,
// retries once after a refresh on 401, then sends the user back to login.
export function useApi() {
  const auth = useAuth()
  const route = useRoute()

  async function api<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}, retried = false): Promise<T> {
    const token = await auth.getAccessToken()
    if (!token) {
      await auth.login(route.fullPath)
      throw new Error('Session expirée')
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
        await auth.login(route.fullPath)
      }
      throw err
    }
  }

  return api
}
