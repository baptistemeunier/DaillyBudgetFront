<script setup lang="ts">
// GoCardless redirects here after consent with ?ref=<connection id> (the requisition reference).
// PATCH /sync links the connection, then its accounts are shown with their first synchronization.
const route = useRoute()
const sync = useSyncConnection()
const { t } = useI18n()
const error = ref<string | null>(null)
const linkedId = ref<string | null>(null)

onMounted(async () => {
  const connectionId = route.query.ref
  // ConsentLinkReused: the link was already used (consent usually given on the first visit),
  // so the sync is still attempted; it fails on its own if the consent is not valid.
  if (route.query.error && route.query.error !== 'ConsentLinkReused') {
    error.value = String(route.query.details ?? route.query.error)
    return
  }
  if (typeof connectionId !== 'string') {
    error.value = t('banks.callback.missingRef')
    return
  }
  try {
    await sync.mutateAsync(connectionId)
    linkedId.value = connectionId
  } catch {
    error.value = t('banks.callback.syncFailed')
  }
})
</script>

<template>
  <main v-if="linkedId" class="flex min-h-dvh flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader back="/">{{ $t('bankConfigure.title') }}</PageHeader>
    <ConnectionSyncProgress :connection-id="linkedId" />
  </main>
  <main v-else class="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
    <template v-if="error">
      <p class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{{ error }}</p>
      <NuxtLink to="/" class="inline-flex min-h-11 items-center rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white">
        {{ $t('banks.callback.backHome') }}
      </NuxtLink>
    </template>
    <p v-else class="text-sm text-slate-500">{{ $t('banks.callback.finishing') }}</p>
  </main>
</template>
