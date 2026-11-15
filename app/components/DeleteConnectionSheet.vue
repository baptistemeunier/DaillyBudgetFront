<script setup lang="ts">
// Bottom sheet to delete a bank connection: keep its accounts, or delete them too.
import { Loader2 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    bankName: string
    /** Display names of the connection's accounts. */
    accountNames: string[]
    pending?: boolean
    error?: string | null
  }>(),
  { pending: false, error: null },
)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [mode: 'keep' | 'delete'] }>()

// "delete" needs the API (in progress): disabled for now.
const DELETE_ACCOUNTS_AVAILABLE = false
const mode = ref<'keep' | 'delete'>('keep')

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(
  open,
  (value) => {
    if (!dialog.value) return
    if (value && !dialog.value.open) {
      mode.value = 'keep'
      dialog.value.showModal()
    }
    if (!value && dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)

function close() {
  if (!props.pending) open.value = false
}
function onCancel(event: Event) {
  event.preventDefault()
  close()
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

const { t } = useI18n()
const count = computed(() => props.accountNames.length)
const namesLabel = computed(() => formatList(props.accountNames))

const options = computed(() => [
  {
    value: 'keep' as const,
    label: t('deleteConnection.keep.label'),
    description: t('deleteConnection.keep.description', count.value),
    disabled: false,
  },
  {
    value: 'delete' as const,
    label: t('deleteConnection.delete.label'),
    description: t('deleteConnection.delete.description', count.value),
    disabled: !DELETE_ACCOUNTS_AVAILABLE,
  },
])
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="fixed inset-x-0 top-auto bottom-0 mx-auto mb-0 w-full max-w-md rounded-t-3xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 [&:not([open])]:hidden"
    @cancel="onCancel"
    @close="open = false"
    @click="onBackdrop"
  >
    <div class="flex flex-col gap-4 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <span class="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />

      <div class="flex flex-col gap-1.5">
        <h2 :id="titleId" class="text-xl font-bold">{{ $t('connection.removeTitle', { bank: bankName }) }}</h2>
        <p class="text-sm text-slate-600">
          {{ $t('deleteConnection.intro') }}
          <template v-if="count">{{ $t('deleteConnection.question', { names: namesLabel }) }}</template>
        </p>
      </div>

      <fieldset v-if="count" class="flex flex-col gap-2">
        <legend class="sr-only">{{ $t('deleteConnection.legend') }}</legend>
        <label
          v-for="option in options"
          :key="option.value"
          class="flex gap-3 rounded-2xl border px-4 py-3"
          :class="[
            mode === option.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200',
            option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          ]"
        >
          <input
            v-model="mode"
            type="radio"
            name="delete-mode"
            :value="option.value"
            :disabled="option.disabled || pending"
            class="mt-0.5 size-5 flex-none accent-indigo-600"
          />
          <span class="flex flex-col gap-0.5">
            <span class="text-[15px] font-semibold">{{ option.label }}</span>
            <span class="text-[13px] text-slate-600">{{ option.description }}</span>
            <span v-if="option.disabled" class="text-xs font-medium text-slate-500">{{ $t('deleteConnection.soon') }}</span>
          </span>
        </label>
      </fieldset>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800" role="alert">{{ error }}</p>

      <div class="grid grid-cols-2 gap-3">
        <button
          type="button"
          class="min-h-12 rounded-full border border-slate-200 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="pending"
          @click="close"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          type="button"
          class="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-3 text-[15px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          :disabled="pending"
          @click="emit('confirm', mode)"
        >
          <Loader2 v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
          {{ $t('deleteConnection.confirm') }}
        </button>
      </div>
    </div>
  </dialog>
</template>
