<script setup lang="ts">
// Notification settings: push on / off per type. A notification always shows in the inbox;
// the switch only decides whether it is also pushed to the phone.
// Also: the large expense threshold and "hide amounts" (lock screen). The low balance threshold is per
// account (AccountSettingsCard). Saved at each change (POST on the first one, PATCH after); the full push
// map is sent each time. On top: Web Push on this device and the subscribed devices (PushDeviceSection).
import type { NotificationSettings, NotificationType } from '~/types/api'

const { t } = useI18n()
const { data: settings, isPending, isError, refetch } = useNotificationSettingsQuery()
const save = useSaveNotificationSettings()
const error = ref<string | null>(null)

const groups: { key: string; types: NotificationType[] }[] = [
  { key: 'connections', types: ['CONNECTION_EXPIRING', 'CONNECTION_EXPIRED', 'CONNECTION_TO_CONFIGURE'] },
  { key: 'accounts', types: ['BALANCE_LOW', 'LARGE_TRANSACTION', 'INCOME_RECEIVED'] },
  { key: 'budget', types: ['MONTH_CLOSING', 'BUDGET_ALMOST_EXCEEDED', 'BUDGET_EXCEEDED'] },
]

const push = computed<Record<NotificationType, boolean>>(() => ({ ...PUSH_DEFAULTS, ...(settings.value?.push ?? {}) }))

async function saveChanges(changes: Partial<Omit<NotificationSettings, '_links'>>) {
  // One save at a time: the first one creates the settings, a second POST would be refused.
  if (save.isPending.value || settings.value === undefined) return
  error.value = null
  try {
    await save.mutateAsync({ current: settings.value, changes })
  } catch (e) {
    error.value = apiErrorMessage(e, t('errors.saveFailedRetry'))
  }
}

const toggle = (type: NotificationType) => saveChanges({ push: { ...push.value, [type]: !push.value[type] } })

// Large expense threshold: saved on blur / Enter; empty = the API default.
const thresholdId = useId()
const defaultThreshold = centsToInput(toCents(DEFAULT_LARGE_TRANSACTION_THRESHOLD))
const toInput = (value: string | null | undefined) => (value ? centsToInput(toCents(value)) : '')
const threshold = ref('')
watch(
  () => settings.value?.largeTransactionThreshold,
  (value) => {
    threshold.value = toInput(value)
  },
  { immediate: true },
)
const thresholdInvalid = ref(false)

function saveThreshold() {
  const input = threshold.value.trim()
  const cents = input ? parseAmountInput(input) : null
  thresholdInvalid.value = !!input && (cents === null || cents <= 0)
  if (thresholdInvalid.value) return
  // Empty: the default is sent explicitly (null may mean something else on the API).
  const value = cents === null ? DEFAULT_LARGE_TRANSACTION_THRESHOLD : centsToDecimal(cents)
  if (cents === null) threshold.value = toInput(value)
  const current = settings.value?.largeTransactionThreshold ?? DEFAULT_LARGE_TRANSACTION_THRESHOLD
  if (toCents(value) === toCents(current)) return
  saveChanges({ largeTransactionThreshold: value })
}

const hideAmounts = computed(() => settings.value?.hideAmounts ?? false)
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
            <SettingSwitch
              :label="$t(`notificationSettings.types.${type}.label`)"
              :hint="$t(`notificationSettings.types.${type}.hint`)"
              :checked="push[type]"
              :disabled="save.isPending.value"
              @toggle="toggle(type)"
            />
            <!-- Threshold of LARGE_TRANSACTION, right under its switch -->
            <div v-if="type === 'LARGE_TRANSACTION'" class="flex flex-col gap-1.5 px-4 pb-4">
              <label :for="thresholdId" class="text-[13px] font-medium text-slate-700">{{ $t('notificationSettings.largeThreshold') }}</label>
              <div class="relative">
                <input
                  :id="thresholdId"
                  v-model="threshold"
                  inputmode="decimal"
                  autocomplete="off"
                  :placeholder="defaultThreshold"
                  :aria-invalid="thresholdInvalid"
                  :aria-describedby="`${thresholdId}-hint`"
                  class="min-h-11 w-full rounded-xl border border-slate-300 bg-white pr-8 pl-3 text-[15px] tabular-nums focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none aria-invalid:border-rose-400"
                  @blur="saveThreshold"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                />
                <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">€</span>
              </div>
              <p v-if="thresholdInvalid" class="text-xs text-rose-700">{{ $t('common.invalidAmount') }}</p>
              <p v-else :id="`${thresholdId}-hint`" class="text-xs text-slate-500">
                {{ $t('notificationSettings.largeThresholdHint', { amount: formatCents(toCents(DEFAULT_LARGE_TRANSACTION_THRESHOLD)) }) }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-2" aria-labelledby="notif-group-privacy">
        <h2 id="notif-group-privacy" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          {{ $t('notificationSettings.groups.privacy') }}
        </h2>
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <SettingSwitch
            :label="$t('notificationSettings.hideAmounts')"
            :hint="$t('notificationSettings.hideAmountsHint')"
            :checked="hideAmounts"
            :disabled="save.isPending.value"
            @toggle="saveChanges({ hideAmounts: !hideAmounts })"
          />
        </div>
      </section>
    </template>
  </main>
</template>
