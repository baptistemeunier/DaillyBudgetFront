<script setup lang="ts">
// Profile > Notifications: Web Push on this device (enable / disable, or why it can't be),
// and the other subscribed devices, which can be removed.
import { Loader2, Smartphone, Trash2 } from 'lucide-vue-next'
import type { PushSubscriptionResource } from '~/types/api'

const { t } = useI18n()
const push = usePushDevice()
const { state, busy } = push
const { data: devices } = usePushSubscriptionsQuery()
const removeDevice = useDeletePushSubscription()
const error = ref<string | null>(null)

onMounted(() => push.refresh())

const subscribed = computed(() => !!state.value.endpoint)

/** Why push can't be turned on here, or null when it can. */
const blocker = computed(() => {
  if (!state.value.checked) return null
  if (state.value.needsInstall && !state.value.supported) return t('pushDevice.needsInstall')
  if (!state.value.supported) return t('pushDevice.unsupported')
  if (state.value.permission === 'denied') return t('pushDevice.denied')
  return null
})

async function toggle() {
  error.value = null
  try {
    if (subscribed.value) await push.disable()
    else if (!(await push.enable()) && state.value.permission === 'denied') error.value = t('pushDevice.denied')
  } catch (e) {
    console.error('[push] enable/disable failed', e)
    // Browser errors (pushManager.subscribe: DOMException) have no API payload: show their own message.
    const browserMessage = e instanceof Error && !apiErrorStatus(e) ? `${e.name}: ${e.message}` : null
    error.value = browserMessage ?? apiErrorMessage(e, t('errors.saveFailedRetry'))
  }
}

const isThisDevice = (d: PushSubscriptionResource) => d.endpoint === state.value.endpoint

async function remove(d: PushSubscriptionResource) {
  error.value = null
  try {
    if (isThisDevice(d)) await push.disable()
    else await removeDevice.mutateAsync(d)
  } catch {
    error.value = t('errors.deleteFailedRetry')
  }
}
</script>

<template>
  <section class="flex flex-col gap-2" aria-labelledby="push-device-title">
    <h2 id="push-device-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
      {{ $t('pushDevice.title') }}
    </h2>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <p v-if="!state.checked" class="px-4 py-4 text-sm text-slate-500">{{ $t('common.loading') }}</p>
      <p v-else-if="blocker" class="px-4 py-4 text-sm text-slate-600">{{ blocker }}</p>
      <button
        v-else
        type="button"
        role="switch"
        :aria-checked="subscribed"
        class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-wait"
        :disabled="busy"
        @click="toggle"
      >
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-[15px] font-medium">{{ $t('pushDevice.enable') }}</span>
          <span class="text-[13px] text-slate-500">{{ subscribed ? $t('pushDevice.onHint') : $t('pushDevice.offHint') }}</span>
        </span>
        <Loader2 v-if="busy" class="size-5 flex-none animate-spin text-slate-400" aria-hidden="true" />
        <span
          v-else
          class="relative h-6 w-10 flex-none rounded-full transition-colors"
          :class="subscribed ? 'bg-indigo-600' : 'bg-slate-300'"
          aria-hidden="true"
        >
          <span class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform" :class="subscribed ? 'translate-x-4' : ''" />
        </span>
      </button>
    </div>

    <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

    <template v-if="devices?.length">
      <h3 class="mt-2 text-[13px] font-semibold text-slate-600">{{ $t('pushDevice.devices') }}</h3>
      <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <li v-for="d in devices" :key="d._links.self.href" class="flex min-h-14 items-center gap-3 pr-2 pl-4">
          <Smartphone class="size-5 flex-none text-slate-500" aria-hidden="true" />
          <span class="flex min-w-0 flex-1 flex-col py-2">
            <span class="truncate text-[15px] font-medium">{{ deviceLabel(d.userAgent) ?? $t('pushDevice.unknownDevice') }}</span>
            <span class="truncate text-xs text-slate-500">
              <template v-if="isThisDevice(d)">{{ $t('pushDevice.thisDevice') }} · </template>
              {{ $t('pushDevice.since', { date: formatDate(d.createdAt) }) }}
            </span>
          </span>
          <button
            type="button"
            class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            :aria-label="$t('pushDevice.remove', { name: deviceLabel(d.userAgent) ?? $t('pushDevice.unknownDevice') })"
            :disabled="busy || removeDevice.isPending.value"
            @click="remove(d)"
          >
            <Trash2 class="size-4" />
          </button>
        </li>
      </ul>
    </template>
  </section>
</template>
