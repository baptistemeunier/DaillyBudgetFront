<script setup lang="ts">
// Bottom sheet to create or edit a categorization rule: words to find in the merchant, direction, category.
// The category picker replaces the form (back arrow), like the split lines of CategorizeSheet.
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-vue-next'
import type { CategorizationRule, TransactionDirection } from '~/types/api'

const props = defineProps<{
  /** Rule to edit; null = create. */
  rule: CategorizationRule | null
  open: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { data: tree } = useCategoriesQuery()
const save = useSaveCategorizationRule()
const error = ref<string | null>(null)

const pattern = ref('')
const direction = ref<TransactionDirection | null>('debit')
const category = ref<string | null>(null)
const picking = ref(false)
const touched = ref(false)

const directions: { value: TransactionDirection | null; key: string }[] = [
  { value: 'debit', key: 'debit' },
  { value: 'credit', key: 'credit' },
  { value: null, key: 'both' },
]
const types = computed(() => ruleTypes(direction.value))
const categoryNode = computed(() => (category.value ? tree.value?.byIri.get(category.value) : undefined))

const patternError = computed(() => (!/\p{L}/u.test(pattern.value) ? t('rules.patternRequired') : null))
const categoryError = computed(() => (!category.value ? t('categorize.chooseCategoryError') : null))

// A category that doesn't fit the new direction is cleared.
watch(direction, () => {
  if (categoryNode.value && !types.value.includes(categoryNode.value.type)) category.value = null
})

const dialog = ref<HTMLDialogElement | null>(null)
const patternInput = ref<HTMLInputElement | null>(null)
const ids = { title: useId(), pattern: useId(), direction: useId() }

watch(
  () => props.open,
  (value) => {
    if (!dialog.value) return
    if (value) {
      // Fresh fields on each opening
      save.reset()
      error.value = null
      touched.value = false
      picking.value = false
      pattern.value = props.rule?.pattern ?? ''
      direction.value = props.rule ? props.rule.direction : 'debit'
      category.value = props.rule ? ruleCategoryIri(props.rule) : null
      if (!dialog.value.open) dialog.value.showModal()
      if (!props.rule) patternInput.value?.focus()
    } else if (dialog.value.open) dialog.value.close()
  },
  { flush: 'post' },
)

function close() {
  if (!save.isPending.value) emit('close')
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

function pick(iri: string) {
  category.value = iri
  picking.value = false
}

async function submit() {
  touched.value = true
  if (patternError.value || categoryError.value || save.isPending.value) return
  error.value = null
  try {
    await save.mutateAsync({
      iri: props.rule?._links.self.href ?? null,
      rule: { pattern: pattern.value.trim(), direction: direction.value, category: category.value! },
    })
    emit('close')
  } catch (e) {
    // 422 without violations: another rule already has this pattern and direction.
    const duplicate = apiErrorStatus(e) === 422 && !(e as { data?: { violations?: unknown[] } }).data?.violations?.length
    error.value = duplicate ? t('rules.duplicate') : apiErrorMessage(e, t('errors.saveFailedRetry'))
  }
}

const input =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 aria-invalid:border-rose-400'
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="ids.title"
    class="fixed inset-x-0 top-auto bottom-0 mx-auto mb-0 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 [&:not([open])]:hidden"
    @cancel.prevent="picking ? (picking = false) : close()"
    @close="emit('close')"
    @click="onBackdrop"
  >
    <header class="flex flex-none items-center gap-3 px-5 pt-4 pb-2">
      <button
        v-if="picking"
        type="button"
        class="-ml-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
        :aria-label="$t('rules.backToRule')"
        @click="picking = false"
      >
        <ChevronLeft class="size-5" />
      </button>
      <h2 :id="ids.title" class="min-w-0 flex-1 truncate text-xl font-bold">
        {{ picking ? $t('categorize.chooseCategory') : rule ? $t('rules.edit') : $t('rules.new') }}
      </h2>
      <button
        type="button"
        class="-mr-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
        :aria-label="$t('common.close')"
        @click="close"
      >
        <X class="size-5" />
      </button>
    </header>

    <div v-if="picking && tree" class="flex-1 overflow-y-auto px-5 pb-5">
      <CategoryPicker :tree="tree" :types="types" :selected="category ? [category] : []" @pick="pick" />
    </div>

    <form
      v-else
      class="flex flex-col gap-4 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      novalidate
      @submit.prevent="submit"
    >
      <div class="flex flex-col gap-1">
        <label :for="ids.pattern" class="text-[13px] font-medium text-slate-700">{{ $t('rules.patternLabel') }}</label>
        <input
          :id="ids.pattern"
          ref="patternInput"
          v-model="pattern"
          maxlength="255"
          autocomplete="off"
          autocapitalize="characters"
          :placeholder="$t('rules.patternPlaceholder')"
          :aria-invalid="touched && !!patternError"
          :class="input"
        />
        <p v-if="touched && patternError" class="text-xs text-rose-700">{{ patternError }}</p>
        <p v-else class="text-xs text-slate-500">{{ $t('rules.patternHint') }}</p>
      </div>

      <div class="flex flex-col gap-1">
        <span :id="ids.direction" class="text-[13px] font-medium text-slate-700">{{ $t('rules.directionLabel') }}</span>
        <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" :aria-labelledby="ids.direction">
          <button
            v-for="d in directions"
            :key="d.key"
            type="button"
            role="radio"
            :aria-checked="direction === d.value"
            class="min-h-10 rounded-lg text-sm font-medium text-slate-600 aria-checked:bg-white aria-checked:font-semibold aria-checked:text-slate-900 aria-checked:shadow-sm"
            @click="direction = d.value"
          >
            {{ $t(`rules.direction.${d.key}`) }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-[13px] font-medium text-slate-700">{{ $t('common.category') }}</span>
        <button
          type="button"
          class="flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left hover:bg-slate-50"
          :class="touched && categoryError ? 'border-rose-400' : 'border-slate-200'"
          :disabled="!tree"
          @click="picking = true"
        >
          <component :is="categoryNode?.icon ?? UNCATEGORIZED_ICON" class="size-5 flex-none text-slate-600" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-[15px]" :class="categoryNode ? 'font-medium' : 'text-slate-500'">
            {{ categoryNode?.fullLabel ?? $t('categorize.chooseCategory') }}
          </span>
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </button>
        <p v-if="touched && categoryError" class="text-xs text-rose-700">{{ categoryError }}</p>
      </div>

      <p class="text-[13px] text-slate-500">{{ $t('rules.applyHint') }}</p>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="min-h-11 rounded-full px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100" @click="close">
          {{ $t('common.cancel') }}
        </button>
        <button
          type="submit"
          class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
          :disabled="save.isPending.value"
        >
          <Loader2 v-if="save.isPending.value" class="size-4 animate-spin" aria-hidden="true" />
          {{ rule ? $t('common.save') : $t('common.create') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
