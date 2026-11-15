<script setup lang="ts">
// Confirmation modal (native <dialog>: focus trap, Esc, top layer for free).
import { Loader2 } from 'lucide-vue-next'
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    confirmLabel: string
    cancelLabel?: string
    tone?: 'danger' | 'primary'
    icon?: Component
    pending?: boolean
    error?: string | null
  }>(),
  { cancelLabel: undefined, tone: 'primary', icon: undefined, pending: false, error: null },
)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(
  open,
  (value) => {
    if (!dialog.value) return
    if (value && !dialog.value.open) dialog.value.showModal()
    if (!value && dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)
onMounted(() => {
  if (open.value) dialog.value?.showModal()
})

function close() {
  if (!props.pending) open.value = false
}

// Esc: keep the dialog open while the action runs
function onCancel(event: Event) {
  event.preventDefault()
  close()
}

function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

const toneClasses = computed(() =>
  props.tone === 'danger'
    ? { badge: 'bg-rose-100 text-rose-600', button: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200' }
    : { badge: 'bg-indigo-100 text-indigo-600', button: 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-200' },
)
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px] open:animate-[dialog-in_150ms_ease-out] [&:not([open])]:hidden"
    @cancel="onCancel"
    @close="open = false"
    @click="onBackdrop"
  >
    <div class="flex flex-col items-center gap-3 px-6 pt-6 pb-5 text-center">
      <span v-if="icon" class="flex size-12 items-center justify-center rounded-full" :class="toneClasses.badge" aria-hidden="true">
        <component :is="icon" class="size-6" />
      </span>

      <h2 :id="titleId" class="text-[17px] font-bold">{{ title }}</h2>

      <div class="text-sm leading-relaxed text-slate-600">
        <slot />
      </div>

      <p v-if="error" class="w-full rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800" role="alert">
        {{ error }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
      <button
        type="button"
        class="min-h-11 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        :disabled="pending"
        @click="close"
      >
        {{ cancelLabel ?? $t('common.cancel') }}
      </button>
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
        :class="toneClasses.button"
        :disabled="pending"
        @click="emit('confirm')"
      >
        <Loader2 v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
        {{ confirmLabel }}
      </button>
    </div>
  </dialog>
</template>

<style>
@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
}
</style>
