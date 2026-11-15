<script setup lang="ts">
// Home: offers Web Push once a bank is connected (banks/callback.vue comes back here), never at load
// on its own: the browser prompt only opens on "Activer". Hidden once answered or dismissed.
import { BellRing, X } from 'lucide-vue-next'

const DISMISS_KEY = 'pushPrompt.dismissed'

const push = usePushDevice()
const { state, busy } = push
const { data: connections } = useConnectionsQuery()

const dismissed = ref(false)
try {
  dismissed.value = localStorage.getItem(DISMISS_KEY) === '1'
} catch {
  // storage unavailable: shown until answered
}
onMounted(() => push.refresh())

const visible = computed(
  () =>
    !dismissed.value &&
    state.value.supported &&
    state.value.permission === 'default' &&
    !!connections.value?.some((c) => c.externalStatus === 'LN'),
)

function dismiss() {
  dismissed.value = true
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

async function enable() {
  try {
    await push.enable()
  } catch {
    // Retry from Profil > Notifications
  }
  // Granted or refused: the browser won't ask again from here.
  dismiss()
}
</script>

<template>
  <article v-if="visible" class="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
    <span class="flex size-10 flex-none items-center justify-center rounded-xl bg-white text-indigo-700" aria-hidden="true">
      <BellRing class="size-5" />
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <p class="text-[15px] font-semibold text-slate-900">{{ $t('pushPrompt.text') }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex h-10 items-center rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          :disabled="busy"
          @click="enable"
        >
          {{ $t('pushPrompt.enable') }}
        </button>
        <button type="button" class="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100" @click="dismiss">
          {{ $t('pushPrompt.later') }}
        </button>
      </div>
    </div>
    <button
      type="button"
      class="-mt-1 -mr-1 flex size-9 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-indigo-100"
      :aria-label="$t('common.close')"
      @click="dismiss"
    >
      <X class="size-4" />
    </button>
  </article>
</template>
