<script setup lang="ts">
// Bottom sheet to create a user sub-category under a root, or rename it / change its icon.
import { Loader2, X } from 'lucide-vue-next'

const props = defineProps<{
  /** IRI of the category to edit; null = create under parentIri. */
  iri: string | null
  parentIri: string | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { data: tree } = useCategoriesQuery()
const node = computed(() => (props.iri ? tree.value?.byIri.get(props.iri) : undefined))
const parent = computed(() => {
  const iri = node.value?.parentIri ?? props.parentIri
  return iri ? tree.value?.byIri.get(iri) : undefined
})

const create = useCreateCategory()
const update = useUpdateCategory()
const pending = computed(() => create.isPending.value || update.isPending.value)
const error = ref<string | null>(null)

const name = ref('')
const icon = ref('tag')
const touched = ref(false)
const iconGridOpen = ref(false)
const nameError = computed(() => (!name.value.trim() ? t('categorySettings.nameRequired') : null))

const dialog = ref<HTMLDialogElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const ids = { title: useId(), name: useId(), icons: useId() }

watch(
  () => props.open,
  (value) => {
    if (!dialog.value) return
    if (value) {
      // Fresh fields on each opening
      error.value = null
      touched.value = false
      iconGridOpen.value = false
      name.value = node.value?.label ?? ''
      icon.value = node.value?.iconName ?? parent.value?.iconName ?? 'tag'
      if (!dialog.value.open) dialog.value.showModal()
      nameInput.value?.focus()
    } else if (dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)

function close() {
  if (!pending.value) emit('close')
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

async function submit() {
  touched.value = true
  if (nameError.value || pending.value) return
  error.value = null
  const fields = { name: name.value.trim(), icon: icon.value }
  try {
    if (props.iri) await update.mutateAsync({ iri: props.iri, changes: fields })
    else if (parent.value) await create.mutateAsync({ ...fields, parent: parent.value.iri })
    emit('close')
  } catch (e) {
    error.value =
      apiErrorStatus(e) === 403 ? t('errors.forbiddenCategory') : apiErrorMessage(e, t('errors.saveFailedRetry'))
  }
}

const input =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 aria-invalid:border-rose-400'
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="ids.title"
    class="fixed inset-x-0 top-auto bottom-0 mx-auto mb-0 w-full max-w-md rounded-t-3xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 [&:not([open])]:hidden"
    @cancel.prevent="close"
    @close="emit('close')"
    @click="onBackdrop"
  >
    <div class="flex flex-col gap-4 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <span class="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 :id="ids.title" class="text-xl font-bold">
            {{ iri ? $t('categorySettings.edit') : $t('categorySettings.new') }}
          </h2>
          <p v-if="parent" class="truncate text-sm text-slate-500">{{ $t('categorySettings.in', { parent: parent.label }) }}</p>
        </div>
        <button
          type="button"
          class="-mr-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
          :aria-label="$t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
        <div class="flex flex-col gap-1">
          <label :for="ids.name" class="text-[13px] font-medium text-slate-700">{{ $t('categorySettings.nameLabel') }}</label>
          <div class="flex items-center gap-2">
            <IconPicker v-model="icon" v-model:open="iconGridOpen" :controls="ids.icons" />
            <input
              :id="ids.name"
              ref="nameInput"
              v-model="name"
              maxlength="100"
              autocomplete="off"
              :placeholder="$t('categoryPicker.namePlaceholder')"
              :aria-invalid="touched && !!nameError"
              :class="[input, 'min-w-0 flex-1']"
            />
          </div>
          <p v-if="touched && nameError" class="text-xs text-rose-700">{{ nameError }}</p>
          <IconGrid v-if="iconGridOpen" :id="ids.icons" v-model="icon" class="mt-1" @picked="iconGridOpen = false" />
        </div>

        <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="min-h-11 rounded-full px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            @click="close"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            type="submit"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
            :disabled="pending"
          >
            <Loader2 v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
            {{ iri ? $t('common.save') : $t('common.create') }}
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>
