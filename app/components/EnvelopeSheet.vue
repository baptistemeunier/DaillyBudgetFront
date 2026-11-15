<script setup lang="ts">
// Bottom sheet to create an envelope (sub-category of the saving root) or edit its name and target.
import { X } from 'lucide-vue-next'
import type { EnvelopeInput } from '~/types/api'

const props = defineProps<{
  /** IRI of the envelope to edit; null = create. */
  iri: string | null
  open: boolean
  currency?: string
}>()
const emit = defineEmits<{ close: [] }>()

const { data: tree } = useCategoriesQuery()
const savingRoot = computed(() => tree.value?.roots.find((r) => r.type === 'saving'))
const node = computed(() => (props.iri ? tree.value?.byIri.get(props.iri) : undefined))

const create = useCreateCategory()
const update = useUpdateCategory()
const pending = computed(() => create.isPending.value || update.isPending.value)
const error = ref<string | null>(null)

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
// Re-mount the form on each opening (fresh fields).
const formKey = ref(0)

watch(
  () => props.open,
  (value) => {
    if (!dialog.value) return
    if (value) {
      error.value = null
      formKey.value++
      if (!dialog.value.open) dialog.value.showModal()
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

async function submit(input: EnvelopeInput) {
  error.value = null
  try {
    if (props.iri) await update.mutateAsync({ iri: props.iri, changes: input })
    else if (savingRoot.value) await create.mutateAsync({ ...input, parent: savingRoot.value.iri })
    emit('close')
  } catch (e) {
    error.value = apiErrorMessage(e, i18nT('errors.saveFailedRetry'))
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="titleId"
    class="fixed inset-x-0 top-auto bottom-0 mx-auto mb-0 w-full max-w-md rounded-t-3xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 [&:not([open])]:hidden"
    @cancel.prevent="close"
    @close="emit('close')"
    @click="onBackdrop"
  >
    <div class="flex flex-col gap-4 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <span class="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
      <div class="flex items-center justify-between gap-3">
        <h2 :id="titleId" class="text-xl font-bold">{{ iri ? $t('envelope.edit') : $t('envelope.new') }}</h2>
        <button
          type="button"
          class="-mr-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-100"
          :aria-label="$t('common.close')"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </div>

      <EnvelopeForm
        v-if="open && (!iri || node)"
        :key="formKey"
        :initial="node ? { name: node.label, icon: node.iconName, targetAmount: node.targetAmount, targetDate: node.targetDate } : {}"
        :currency="currency"
        :submit-label="iri ? $t('common.save') : $t('common.create')"
        :pending="pending"
        :error="error"
        @submit="submit"
        @cancel="close"
      />
    </div>
  </dialog>
</template>
