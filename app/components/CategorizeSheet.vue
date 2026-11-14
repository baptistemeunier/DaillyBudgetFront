<script setup lang="ts">
// Bottom sheet to categorize a transaction.
// Simple: one category for the full amount. Ventiler: several (category, amount) lines;
// a partial split is allowed — the remainder stays uncategorized.
// Bulk (`transactions`): simple mode only, the picked category is applied to each one.
import { ChevronLeft, Plus, Trash2, X } from 'lucide-vue-next'
import type { CategoryType, Transaction } from '~/types/api'

const props = defineProps<{
  transaction?: Transaction | null
  /** Several transactions at once (bulk, simple mode only). */
  transactions?: Transaction[] | null
}>()
const emit = defineEmits<{
  close: []
  /** Hrefs of the transactions successfully saved. */
  saved: [hrefs: string[]]
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const { data: tree, isPending: treePending, isError: treeError, refetch: refetchTree } = useCategoriesQuery()
const update = useUpdateSplits()

interface Line {
  key: number
  category: string | null
  input: string // positive amount typed by the user ("12,50")
}

const mode = ref<'simple' | 'split'>('simple')
const lines = ref<Line[]>([])
const picking = ref<number | null>(null) // index of the split line choosing its category
const error = ref<string | null>(null)
let nextKey = 0

const t = computed(() => props.transaction ?? null)
const bulk = computed(() => (props.transactions?.length ? props.transactions : null))
const bulkPending = ref(false)

// Category types allowed for every transaction (debits + credits mixed -> transfers only).
const bulkTypes = computed<CategoryType[]>(() =>
  (bulk.value ?? []).reduce<CategoryType[]>(
    (types, tr) => types.filter((type) => allowedTypes(toCents(tr.amount)).includes(type)),
    ['expense', 'income', 'transfer'],
  ),
)

// Sum shown in the bulk header, only when every transaction has the same currency.
const bulkTotal = computed(() => {
  const items = bulk.value
  if (!items) return null
  const currencies = new Set(items.map((tr) => tr.currency))
  if (currencies.size !== 1) return null
  return { cents: items.reduce((sum, tr) => sum + toCents(tr.amount), 0), currency: items[0]!.currency }
})
const amountCents = computed(() => (t.value ? toCents(t.value.amount) : 0))
const absAmount = computed(() => Math.abs(amountCents.value))
const sign = computed(() => (amountCents.value < 0 ? -1 : 1))
const currency = computed(() => t.value?.currency ?? 'EUR')

const currentIris = computed(() =>
  (t.value?.splits ?? []).map(splitCategoryIri).filter((i): i is string => !!i),
)

const parseInput = parseAmountInput

const allocated = computed(() => lines.value.reduce((sum, l) => sum + (parseInput(l.input) ?? 0), 0))
const remaining = computed(() => absAmount.value - allocated.value)

const usedIris = computed(() => lines.value.map((l) => l.category).filter((c): c is string => !!c))

const lineErrors = computed(() =>
  lines.value.map((l) => {
    const cents = parseInput(l.input)
    if (!l.category) return 'Choisissez une catégorie'
    if (cents === null || cents === 0) return 'Montant invalide'
    return null
  }),
)

const canSave = computed(
  () =>
    !update.isPending.value &&
    remaining.value >= 0 &&
    lineErrors.value.every((e) => e === null) &&
    new Set(usedIris.value).size === usedIris.value.length,
)

// (Re)initialise when a transaction (or a bulk selection) is opened.
watch([t, bulk], ([transaction, items]) => {
  error.value = null
  picking.value = null
  if (!transaction && !items) {
    dialog.value?.close()
    return
  }

  if (!transaction) {
    mode.value = 'simple'
    lines.value = []
    nextTick(() => {
      if (!dialog.value?.open) dialog.value?.showModal()
    })
    return
  }

  const splits = transaction.splits ?? []
  lines.value = splits.map((s) => ({
    key: nextKey++,
    category: splitCategoryIri(s),
    input: centsToInput(Math.abs(toCents(s.amount)), true),
  }))
  const status = categorizationStatus(transaction, tree.value)
  mode.value = status.kind === 'split' || status.kind === 'partial' ? 'split' : 'simple'

  nextTick(() => {
    if (!dialog.value?.open) dialog.value?.showModal()
  })
})

function addLine() {
  lines.value.push({ key: nextKey++, category: null, input: remaining.value > 0 ? centsToInput(remaining.value, true) : '' })
  picking.value = lines.value.length - 1
}

function removeLine(index: number) {
  lines.value.splice(index, 1)
}

function pickForLine(iri: string) {
  if (picking.value === null) return
  lines.value[picking.value]!.category = iri
  picking.value = null
}

function errorMessage(e: unknown): string {
  if (apiErrorStatus(e) === 403) return "Vous n'avez pas le droit de modifier cette transaction."
  return apiErrorMessage(e)
}

async function save(splits: { category: string; amount: string }[]) {
  if (!t.value) return
  error.value = null
  try {
    await update.mutateAsync({ transaction: t.value, splits })
    emit('saved', [t.value._links.self.href])
    emit('close')
  } catch (e) {
    error.value = errorMessage(e)
  }
}

function pickSimple(iri: string) {
  save([{ category: iri, amount: t.value!.amount }])
}

async function pickBulk(iri: string) {
  const items = bulk.value
  if (!items || bulkPending.value) return
  error.value = null
  bulkPending.value = true
  try {
    const results = await Promise.allSettled(
      items.map((tr) => update.mutateAsync({ transaction: tr, splits: [{ category: iri, amount: tr.amount }] })),
    )
    const saved = items.filter((_, i) => results[i]!.status === 'fulfilled').map((tr) => tr._links.self.href)
    emit('saved', saved)
    const failed = items.length - saved.length
    if (failed === 0) emit('close')
    else
      error.value = `${failed} transaction${failed > 1 ? 's' : ''} sur ${items.length} n'${failed > 1 ? 'ont' : 'a'} pas pu être catégorisée${failed > 1 ? 's' : ''}.`
  } finally {
    bulkPending.value = false
  }
}

function saveSplit() {
  if (!canSave.value) return
  save(
    lines.value.map((l) => ({
      category: l.category!,
      amount: centsToDecimal(sign.value * (parseInput(l.input) ?? 0)),
    })),
  )
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="fixed inset-x-0 top-auto bottom-0 mx-auto mb-0 flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 [&:not([open])]:hidden"
    aria-labelledby="categorize-title"
    @close="emit('close')"
    @click="onBackdropClick"
  >
    <template v-if="bulk">
      <header class="flex flex-none items-start gap-3 border-b border-slate-100 px-4 pt-4 pb-3">
        <div class="flex min-w-0 flex-1 flex-col">
          <h2 id="categorize-title" class="truncate text-[17px] font-bold">{{ bulk.length }} transactions</h2>
          <p v-if="bulkTotal" class="text-[13px] text-slate-500">
            Total ·
            <span class="font-semibold tabular-nums" :class="bulkTotal.cents > 0 ? 'text-emerald-700' : 'text-slate-900'">
              {{ formatSignedCents(bulkTotal.cents, bulkTotal.currency) }}
            </span>
          </p>
        </div>
        <button
          type="button"
          class="-mr-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <X class="size-5" />
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-4 py-3">
        <p v-if="error" class="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

        <div v-if="treePending" class="flex flex-col gap-2" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="h-12 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div v-else-if="treeError || !tree" class="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2">
          <span class="text-sm text-rose-800">Impossible de charger les catégories.</span>
          <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetchTree()">Réessayer</button>
        </div>
        <CategoryPicker v-else :tree="tree" :types="bulkTypes" :selected="[]" :busy="bulkPending" @pick="pickBulk" />
      </div>
    </template>

    <template v-else-if="t">
      <!-- Header -->
      <header class="flex flex-none items-start gap-3 border-b border-slate-100 px-4 pt-4 pb-3">
        <button
          v-if="picking !== null"
          type="button"
          class="-ml-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
          aria-label="Retour à la ventilation"
          @click="picking = null"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="flex min-w-0 flex-1 flex-col">
          <h2 id="categorize-title" class="truncate text-[17px] font-bold">
            {{ picking !== null ? 'Choisir une catégorie' : t.description }}
          </h2>
          <p class="text-[13px] text-slate-500">
            {{ t.bookingAt ? dayLabel(dayKey(t.bookingAt)) : '' }}
            ·
            <span class="font-semibold tabular-nums" :class="amountCents > 0 ? 'text-emerald-700' : 'text-slate-900'">
              {{ formatSignedCents(amountCents, currency) }}
            </span>
          </p>
        </div>
        <button
          type="button"
          class="-mr-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
          aria-label="Fermer"
          @click="emit('close')"
        >
          <X class="size-5" />
        </button>
      </header>

      <!-- Mode switch -->
      <div v-if="picking === null" class="flex-none px-4 pt-3">
        <div class="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'simple'"
            class="min-h-10 rounded-lg"
            :class="mode === 'simple' ? 'bg-white shadow-sm' : 'text-slate-500'"
            @click="mode = 'simple'"
          >
            Simple
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'split'"
            class="min-h-10 rounded-lg"
            :class="mode === 'split' ? 'bg-white shadow-sm' : 'text-slate-500'"
            @click="mode = 'split'"
          >
            Ventiler
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-4 py-3">
        <p v-if="error" class="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{{ error }}</p>

        <div v-if="treePending" class="flex flex-col gap-2" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="h-12 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div v-else-if="treeError || !tree" class="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2">
          <span class="text-sm text-rose-800">Impossible de charger les catégories.</span>
          <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetchTree()">Réessayer</button>
        </div>

        <!-- Category choice for a split line -->
        <CategoryPicker
          v-else-if="picking !== null"
          :tree="tree"
          :types="allowedTypes(amountCents)"
          :selected="lines[picking]?.category ? [lines[picking]!.category!] : []"
          :disabled="usedIris"
          @pick="pickForLine"
        />

        <!-- Simple -->
        <template v-else-if="mode === 'simple'">
          <CategoryPicker
            :tree="tree"
            :types="allowedTypes(amountCents)"
            :selected="currentIris.length === 1 ? currentIris : []"
            :busy="update.isPending.value"
            @pick="pickSimple"
          />
          <button
            v-if="t.splits?.length"
            type="button"
            class="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            :disabled="update.isPending.value"
            @click="save([])"
          >
            Retirer la catégorie
          </button>
        </template>

        <!-- Ventiler -->
        <template v-else>
          <ul class="flex flex-col gap-2">
            <li
              v-for="(line, index) in lines"
              :key="line.key"
              class="flex flex-col gap-1 rounded-2xl border border-slate-200 p-2"
            >
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left hover:bg-slate-50"
                  @click="picking = index"
                >
                  <span aria-hidden="true">{{ line.category ? tree.byIri.get(line.category)?.emoji : '❔' }}</span>
                  <span class="truncate text-[15px]" :class="line.category ? 'font-medium' : 'text-slate-500'">
                    {{ line.category ? (tree.byIri.get(line.category)?.fullLabel ?? 'Catégorie') : 'Choisir une catégorie' }}
                  </span>
                </button>
                <label class="relative w-28 flex-none">
                  <span class="sr-only">Montant</span>
                  <input
                    v-model="line.input"
                    inputmode="decimal"
                    placeholder="0,00"
                    class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-7 pl-3 text-right text-[15px] tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">€</span>
                </label>
                <button
                  type="button"
                  class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                  aria-label="Supprimer la ligne"
                  @click="removeLine(index)"
                >
                  <Trash2 class="size-5" />
                </button>
              </div>
              <p v-if="lineErrors[index] && (line.category || line.input)" class="px-2 text-xs text-rose-700">
                {{ lineErrors[index] }}
              </p>
            </li>
          </ul>

          <button
            type="button"
            class="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700"
            @click="addLine"
          >
            <Plus class="size-5" aria-hidden="true" /> Ajouter une ligne
          </button>
        </template>
      </div>

      <!-- Footer (Ventiler) -->
      <footer
        v-if="picking === null && mode === 'split' && tree"
        class="flex flex-none items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"
      >
        <p class="text-[13px]" aria-live="polite">
          <template v-if="remaining < 0">
            <span class="font-semibold text-rose-700">Dépasse de {{ formatCents(-remaining, currency) }}</span>
          </template>
          <template v-else>
            <span class="text-slate-500">Non catégorisé : </span>
            <span class="font-semibold tabular-nums" :class="remaining === 0 ? 'text-emerald-700' : 'text-amber-700'">
              {{ formatCents(remaining, currency) }}
            </span>
          </template>
        </p>
        <button
          type="button"
          class="min-h-11 flex-none rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
          :disabled="!canSave"
          @click="saveSplit"
        >
          {{ update.isPending.value ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </footer>
    </template>
  </dialog>
</template>
