<script setup lang="ts">
// Bottom sheet to categorize a transaction.
// Simple: one category for the full amount. Ventiler: several (category, amount) lines;
// a partial split is allowed — the remainder stays uncategorized. Both take expense / income only.
// Transfert: to / from another account (transfer or saving categories, see TransferCategorize).
// Bulk (`transactions`): simple mode only, the picked category is applied to each one.
// "Toujours pour <merchant>" switch (simple mode): also saves the rule merchant → category (rememberCategory).
import { ChevronLeft, Plus, Trash2, X } from 'lucide-vue-next'
import type { SplitInput } from '~/composables/useBankingQueries'
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

const i18n = useI18n()
const dialog = ref<HTMLDialogElement | null>(null)
const { data: tree, isPending: treePending, isError: treeError, refetch: refetchTree } = useCategoriesQuery()
const update = useUpdateSplits()

// Type of the transaction's account: savings / investment accounts also take saving categories.
const { data: accounts } = useAllAccountsQuery()
const accountOf = (tr: Transaction) => accounts.value?.find((a) => a._links.self.href === tr._links.account?.href)
const accountTypeOf = (tr: Transaction) => accountOf(tr)?.type ?? null

interface Line {
  key: number
  category: string | null
  input: string // positive amount typed by the user ("12,50")
}

const mode = ref<'simple' | 'split' | 'transfer'>('simple')
const lines = ref<Line[]>([])
const picking = ref<number | null>(null) // index of the split line choosing its category
const error = ref<string | null>(null)
let nextKey = 0

const t = computed(() => props.transaction ?? null)
const bulk = computed(() => (props.transactions?.length ? props.transactions : null))
const bulkPending = ref(false)
const remember = ref(false)

// The API only remembers a merchant of a bank account (manual accounts have no rule).
const canRemember = computed(() => !!t.value?.merchantKey && accountOf(t.value)?.manual === false)

// Category types allowed for every transaction (debits + credits, or savings + checking accounts mixed -> none).
const bulkTypes = computed<CategoryType[]>(() =>
  (bulk.value ?? []).reduce<CategoryType[]>(
    (types, tr) => types.filter((type) => allowedTypes(toCents(tr.amount), accountTypeOf(tr)).includes(type)),
    ['expense', 'income', 'saving'],
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
const types = computed(() => (t.value ? allowedTypes(amountCents.value, accountTypeOf(t.value)) : []))
const absAmount = computed(() => Math.abs(amountCents.value))
const sign = computed(() => (amountCents.value < 0 ? -1 : 1))
const currency = computed(() => t.value?.currency ?? 'EUR')

// Bank detail, shown when it adds something to the description.
const detail = computed(() => {
  const d = t.value?.detail?.trim()
  return d && d !== t.value?.description.trim() ? d : null
})

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
    if (!l.category) return i18n.t('categorize.chooseCategoryError')
    if (cents === null || cents === 0) return i18n.t('common.invalidAmount')
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
  remember.value = false
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
  // Transfert tab: a transfer, or a saving towards another account (with a mirror, or from a checking account).
  const savingAccount = accountTypeOf(transaction) !== null && accountTypeOf(transaction) !== 'checking'
  const isTransfer = splits.some((s) => {
    const iri = splitCategoryIri(s)
    const type = iri ? tree.value?.byIri.get(iri)?.type : undefined
    if (type === 'transfer') return true
    return type === 'saving' && (!!s._links?.counterpartAccount || !savingAccount)
  })
  mode.value = isTransfer ? 'transfer' : status.kind === 'split' || status.kind === 'partial' ? 'split' : 'simple'
  // Transfer / saving lines aren't editable in Ventiler.
  if (isTransfer) lines.value = []

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
  if (apiErrorStatus(e) === 403) return i18n.t('errors.forbiddenTransaction')
  return apiErrorMessage(e)
}

async function save(splits: SplitInput[], rememberCategory = false) {
  if (!t.value) return
  error.value = null
  try {
    await update.mutateAsync({ transaction: t.value, splits, rememberCategory })
    emit('saved', [t.value._links.self.href])
    emit('close')
  } catch (e) {
    error.value = errorMessage(e)
  }
}

function pickSimple(iri: string) {
  // A saving category can't be remembered (its mirror needs a manual account): saved without the rule.
  const rememberCategory = remember.value && canRemember.value && tree.value?.byIri.get(iri)?.type !== 'saving'
  save([{ category: iri, amount: t.value!.amount }], rememberCategory)
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
    else error.value = i18n.t('categorize.bulkFailed', { failed, total: items.length }, failed)
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
          <h2 id="categorize-title" class="truncate text-[17px] font-bold">{{ $t('common.transactionCount', bulk.length) }}</h2>
          <p v-if="bulkTotal" class="text-[13px] text-slate-500">
            {{ $t('categorize.total') }} ·
            <span class="font-semibold tabular-nums" :class="bulkTotal.cents > 0 ? 'text-emerald-700' : 'text-slate-900'">
              {{ formatSignedCents(bulkTotal.cents, bulkTotal.currency) }}
            </span>
          </p>
        </div>
        <button
          type="button"
          class="-mr-2 flex size-11 flex-none items-center justify-center rounded-full hover:bg-slate-100"
          :aria-label="$t('common.close')"
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
          <span class="text-sm text-rose-800">{{ $t('errors.loadCategories') }}</span>
          <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetchTree()">{{ $t('common.retry') }}</button>
        </div>
        <p v-else-if="!bulkTypes.length" class="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
          {{ $t('categorize.noCommonCategory') }}
        </p>
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
          :aria-label="$t('categorize.backToSplit')"
          @click="picking = null"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="flex min-w-0 flex-1 flex-col">
          <h2 id="categorize-title" class="text-[17px] font-bold" :class="picking !== null ? 'truncate' : 'break-words'">
            {{ picking !== null ? $t('categorize.chooseCategory') : t.description }}
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
          :aria-label="$t('common.close')"
          @click="emit('close')"
        >
          <X class="size-5" />
        </button>
      </header>

      <!-- Bank detail -->
      <p
        v-if="picking === null && detail"
        class="mx-4 mt-3 max-h-32 flex-none overflow-y-auto rounded-2xl bg-slate-50 px-3 py-2.5 text-[13px] break-words whitespace-pre-line text-slate-700"
      >{{ detail }}</p>

      <!-- Mode switch -->
      <div v-if="picking === null" class="flex-none px-4 pt-3">
        <div class="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm font-semibold" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'simple'"
            class="min-h-10 rounded-lg"
            :class="mode === 'simple' ? 'bg-white shadow-sm' : 'text-slate-500'"
            @click="mode = 'simple'"
          >
            {{ $t('categorize.mode.simple') }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'split'"
            class="min-h-10 rounded-lg"
            :class="mode === 'split' ? 'bg-white shadow-sm' : 'text-slate-500'"
            @click="mode = 'split'"
          >
            {{ $t('categorize.mode.split') }}
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="mode === 'transfer'"
            class="min-h-10 rounded-lg"
            :class="mode === 'transfer' ? 'bg-white shadow-sm' : 'text-slate-500'"
            @click="mode = 'transfer'"
          >
            {{ $t('categorize.mode.transfer') }}
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
          <span class="text-sm text-rose-800">{{ $t('errors.loadCategories') }}</span>
          <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetchTree()">{{ $t('common.retry') }}</button>
        </div>

        <!-- Category choice for a split line -->
        <CategoryPicker
          v-else-if="picking !== null"
          :tree="tree"
          :types="types"
          :selected="lines[picking]?.category ? [lines[picking]!.category!] : []"
          :disabled="usedIris"
          @pick="pickForLine"
        />

        <!-- Transfert -->
        <TransferCategorize
          v-else-if="mode === 'transfer'"
          :transaction="t"
          :tree="tree"
          :pending="update.isPending.value"
          @save="save"
        />

        <!-- Simple -->
        <template v-else-if="mode === 'simple'">
          <button
            v-if="canRemember"
            type="button"
            role="switch"
            :aria-checked="remember"
            class="mb-3 flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors"
            :class="remember ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'"
            @click="remember = !remember"
          >
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[15px] font-medium">{{ $t('categorize.remember', { merchant: t.merchantKey }) }}</span>
              <span class="text-[13px] text-slate-500">{{ $t('categorize.rememberHint') }}</span>
            </span>
            <span
              class="relative h-6 w-10 flex-none rounded-full transition-colors"
              :class="remember ? 'bg-indigo-600' : 'bg-slate-300'"
              aria-hidden="true"
            >
              <span
                class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform"
                :class="remember ? 'translate-x-4' : ''"
              />
            </span>
          </button>
          <CategoryPicker
            :tree="tree"
            :types="types"
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
            {{ $t('categorize.removeCategory') }}
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
                  <component
                    :is="(line.category && tree.byIri.get(line.category)?.icon) || UNCATEGORIZED_ICON"
                    class="size-5 flex-none text-slate-600"
                    aria-hidden="true"
                  />
                  <span class="truncate text-[15px]" :class="line.category ? 'font-medium' : 'text-slate-500'">
                    {{ line.category ? (tree.byIri.get(line.category)?.fullLabel ?? $t('common.category')) : $t('categorize.chooseCategory') }}
                  </span>
                </button>
                <label class="relative w-28 flex-none">
                  <span class="sr-only">{{ $t('common.amount') }}</span>
                  <input
                    v-model="line.input"
                    inputmode="decimal"
                    :placeholder="$t('common.amountPlaceholder')"
                    class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-7 pl-3 text-right text-[15px] tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">€</span>
                </label>
                <button
                  type="button"
                  class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                  :aria-label="$t('categorize.removeLine')"
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
            <Plus class="size-5" aria-hidden="true" /> {{ $t('categorize.addLine') }}
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
            <span class="font-semibold text-rose-700">{{ $t('categorize.over', { amount: formatCents(-remaining, currency) }) }}</span>
          </template>
          <template v-else>
            <span class="text-slate-500">{{ $t('categorize.uncategorizedRemaining') }} </span>
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
          {{ update.isPending.value ? $t('common.saving') : $t('common.save') }}
        </button>
      </footer>
    </template>
  </dialog>
</template>
