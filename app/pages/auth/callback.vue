<script setup lang="ts">
const route = useRoute()
const auth = useAuth()
const error = ref<string | null>(null)

onMounted(async () => {
  const { code, state, error: oauthError, error_description } = route.query

  if (oauthError) {
    error.value = String(error_description ?? oauthError)
    return
  }
  if (typeof code !== 'string' || typeof state !== 'string') {
    error.value = 'Réponse du serveur d’authentification incomplète.'
    return
  }

  try {
    await navigateTo(await auth.handleCallback(code, state), { replace: true })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Connexion impossible.'
  }
})
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
    <template v-if="error">
      <p class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{{ error }}</p>
      <button
        type="button"
        class="min-h-11 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white"
        @click="auth.login('/')"
      >
        Réessayer
      </button>
    </template>
    <p v-else class="text-sm text-slate-500">Connexion en cours…</p>
  </main>
</template>
