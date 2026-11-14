<script setup lang="ts">
// Saving envelope form: name, icon (suggested from the name until picked), target amount (required)
// and target date (optional).
import { Loader2 } from 'lucide-vue-next'
import type { EnvelopeInput } from '~/types/api'

const props = withDefaults(
  defineProps<{
    initial?: Partial<EnvelopeInput>
    currency?: string
    submitLabel: string
    pending?: boolean
    error?: string | null
    /** Tighter layout (inside the category picker). */
    compact?: boolean
  }>(),
  { initial: () => ({}), currency: 'EUR', pending: false, error: null, compact: false },
)
const emit = defineEmits<{ submit: [input: EnvelopeInput]; cancel: [] }>()

const name = ref(props.initial.name ?? '')
const amount = ref(props.initial.targetAmount ? centsToInput(toCents(props.initial.targetAmount), true) : '')
const date = ref(props.initial.targetDate?.slice(0, 10) ?? '')
// Icon: the saved one, else suggested from the name until the user picks one.
const pickedIcon = ref<string | null>(props.initial.icon ?? null)
const icon = computed({
  get: () => pickedIcon.value ?? suggestEnvelopeIcon(name.value),
  set: (value: string) => {
    pickedIcon.value = value
  },
})

const ids = { name: useId(), amount: useId(), date: useId(), icons: useId() }
const iconGridOpen = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)
onMounted(() => nameInput.value?.focus())

const touched = ref(false)
const cents = computed(() => parseAmountInput(amount.value))
const nameError = computed(() => (!name.value.trim() ? "Donne un nom à l'enveloppe." : null))
const amountError = computed(() =>
  !amount.value.trim() ? "Indique l'objectif à atteindre." : !cents.value ? 'Montant invalide (ex. 3 500).' : null,
)
const today = dayKey(new Date())

function submit() {
  touched.value = true
  if (nameError.value || amountError.value || props.pending) return
  emit('submit', {
    name: name.value.trim(),
    icon: icon.value,
    targetAmount: centsToDecimal(cents.value!),
    targetDate: date.value || null,
  })
}

const input =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 aria-invalid:border-rose-400'
</script>

<template>
  <form class="flex flex-col" :class="compact ? 'gap-2.5' : 'gap-4'" novalidate @submit.prevent="submit" @keydown.esc.stop.prevent="emit('cancel')">
    <div class="flex flex-col gap-1">
      <label :for="ids.name" class="text-[13px] font-medium text-slate-700">Nom de l'enveloppe</label>
      <div class="flex items-center gap-2">
        <IconPicker v-model="icon" v-model:open="iconGridOpen" :controls="ids.icons" />
        <input
          :id="ids.name"
          ref="nameInput"
          v-model="name"
          maxlength="100"
          autocomplete="off"
          placeholder="Vacances, fonds d'urgence…"
          :aria-invalid="touched && !!nameError"
          :class="[input, 'min-w-0 flex-1']"
        />
      </div>
      <p v-if="touched && nameError" class="text-xs text-rose-700">{{ nameError }}</p>
      <IconGrid v-if="iconGridOpen" :id="ids.icons" v-model="icon" class="mt-1" @picked="iconGridOpen = false" />
    </div>

    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
      <div class="flex flex-col gap-1">
        <label :for="ids.amount" class="text-[13px] font-medium text-slate-700">Objectif</label>
        <span class="relative">
          <input
            :id="ids.amount"
            v-model="amount"
            inputmode="decimal"
            autocomplete="off"
            placeholder="3 500"
            :aria-invalid="touched && !!amountError"
            :class="[input, 'pr-12 text-right tabular-nums']"
          />
          <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-500">{{ currency }}</span>
        </span>
      </div>
      <div class="flex flex-col gap-1">
        <label :for="ids.date" class="text-[13px] font-medium text-slate-700">
          Pour le <span class="font-normal text-slate-500">(facultatif)</span>
        </label>
        <input :id="ids.date" v-model="date" type="date" :min="today" :class="input" />
      </div>
    </div>
    <p v-if="touched && amountError" class="-mt-1 text-xs text-rose-700">{{ amountError }}</p>

    <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

    <div class="flex justify-end gap-2">
      <button
        type="button"
        class="min-h-11 rounded-full px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        @click="emit('cancel')"
      >
        Annuler
      </button>
      <button
        type="submit"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
        :disabled="pending"
      >
        <Loader2 v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
        {{ submitLabel }}
      </button>
    </div>
  </form>
</template>
