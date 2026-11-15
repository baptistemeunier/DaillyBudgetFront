<script setup lang="ts">
// Notification settings: push on / off per type. A notification always shows in the inbox;
// the switch only decides whether it is also pushed to the phone.
// Saved at each switch (POST on the first change, PATCH after); the full push map is sent each time.
// On top: Web Push on this device and the subscribed devices (PushDeviceSection).
import type { NotificationType } from '~/types/api'

const { t } = useI18n()
const { data: settings, isPending, isError, refetch } = useNotificationSettingsQuery()
const save = useSaveNotificationSettings()
const error = ref<string | null>(null)

const groups: { key: string; types: NotificationType[] }[] = [
  { key: 'connections', types: ['CONNECTION_EXPIRING', 'CONNECTION_EXPIRED', 'CONNECTION_TO_CONFIGURE'] },
  { key: 'budget', types: ['MONTH_CLOSING'] },
]

const push = computed<Record<NotificationType, boolean>>(() => ({ ...PUSH_DEFAULTS, ...(settings.value?.push ?? {}) }))

async function toggle(type: NotificationType) {
  // One save at a time: the first one creates the settings, a second POST would be refused.
  if (save.isPending.value || settings.value === undefined) return
  error.value = null
  try {
    await save.mutateAsync({ current: settings.value, changes: { push: { ...push.value, [type]: !push.value[type] } } })
  } catch (e) {
    error.value = apiErrorMessage(e, t('errors.saveFailedRetry'))
  }
}
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader :title="$t('notificationSettings.title')" back="/profile" />

    <p class="text-sm text-slate-600">{{ $t('notificationSettings.intro') }}</p>

    <PushDeviceSection />

    <p v-if="isPending" class="py-8 text-center text-sm text-slate-500">{{ $t('common.loading') }}</p>
    <div v-else-if="isError" class="flex flex-col items-center gap-3 py-8">
      <p class="text-sm text-slate-600">{{ $t('common.loadInterrupted') }}</p>
      <button type="button" class="min-h-11 rounded-full px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50" @click="refetch()">
        {{ $t('common.retry') }}
      </button>
    </div>

    <template v-else>
      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

      <section v-for="group in groups" :key="group.key" class="flex flex-col gap-2" :aria-labelledby="`notif-group-${group.key}`">
        <h2 :id="`notif-group-${group.key}`" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          {{ $t(`notificationSettings.groups.${group.key}`) }}
        </h2>
        <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <li v-for="type in group.types" :key="type">
            <button
              type="button"
              role="switch"
              :aria-checked="push[type]"
              class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-wait"
              :disabled="save.isPending.value"
              @click="toggle(type)"
            >
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-[15px] font-medium">{{ $t(`notificationSettings.types.${type}.label`) }}</span>
                <span class="text-[13px] text-slate-500">{{ $t(`notificationSettings.types.${type}.hint`) }}</span>
              </span>
              <span
                class="relative h-6 w-10 flex-none rounded-full transition-colors"
                :class="push[type] ? 'bg-indigo-600' : 'bg-slate-300'"
                aria-hidden="true"
              >
                <span
                  class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform"
                  :class="push[type] ? 'translate-x-4' : ''"
                />
              </span>
            </button>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
