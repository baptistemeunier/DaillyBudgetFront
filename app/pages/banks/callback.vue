<script setup lang="ts">
// GoCardless redirects here after consent with ?ref=<connection id> (the requisition reference).
const route = useRoute()
const sync = useSyncConnection()
const { t } = useI18n()
const error = ref<string | null>(null)

onMounted(async () => {
  const connectionId = route.query.ref
  if (route.query.error) {
    error.value = String(route.query.details ?? route.query.error)
    return
  }
  if (typeof connectionId !== 'string') {
    error.value = t('banks.callback.missingRef')
    return
  }
  try {
    await sync.mutateAsync(connectionId)
    await navigateTo('/', { replace: true })
  } catch {
    error.value = t('banks.callback.syncFailed')
  }
})
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
    <template v-if="error">
      <p class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{{ error }}</p>
      <NuxtLink to="/" class="inline-flex min-h-11 items-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white">
        {{ $t('banks.callback.backHome') }}
      </NuxtLink>
    </template>
    <p v-else class="text-sm text-slate-500">{{ $t('banks.callback.finishing') }}</p>
  </main>
</template>
