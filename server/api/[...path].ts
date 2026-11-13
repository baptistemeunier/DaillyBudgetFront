// Same-origin proxy: /api/<path> -> <apiBaseUrl>/<path> (avoids CORS on the Symfony API).
export default defineEventHandler((event) => {
  const { apiBaseUrl } = useRuntimeConfig(event)
  const target = apiBaseUrl.replace(/\/$/, '') + event.path.replace(/^\/api/, '')

  return proxyRequest(event, target)
})
