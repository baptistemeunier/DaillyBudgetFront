<script setup lang="ts">
// Monthly budget: one total, split across the root expense categories.
// An empty category field means 0: no line is sent for it.
import { CircleAlert, CircleCheck } from 'lucide-vue-next'
import type { BudgetLineInput } from '~/types/api'

definePageMeta({ tabs: true })

const { data: budget, isPending: budgetPending, isError: budgetError, refetch: refetchBudget } =
  useBudgetQuery()
const { data: tree, isPending: treePending, isError: treeError, refetch: refetchTree } = useCategoriesQuery()
const save = useSaveBudget()

const roots = computed(() => (tree.value?.roots ?? []).filter((r) => r.type === 'expense'))
const currency = computed(() => budget.value?.currency ?? 'EUR')

const amountInput = ref('')
const lineInputs = ref<Record<string, string>>({})
const initialPayload = ref<string | null>(null)

const amountCents = computed(() => parseAmountInput(amountInput.value))
const amountInvalid = computed(() => amountInput.value.trim() !== '' && (amountCents.value === null || amountCents.value <= 0))

/** null = empty, NaN = invalid. */
function lineCents(iri: string): number | null {
  const input = lineInputs.value[iri]?.trim() ?? ''
  if (input === '') return null
  return parseAmountInput(input) ?? Number.NaN
}

const lineInvalid = (iri: string) => Number.isNaN(lineCents(iri))

const allocated = computed(() =>
  roots.value.reduce((sum, r) => {
    const c = lineCents(r.iri)
    return c && !Number.isNaN(c) ? sum + c : sum
  }, 0),
)
const total = computed(() => amountCents.value ?? 0)
const over = computed(() => allocated.value > total.value)

const payload = computed<{ amount: string; lines: BudgetLineInput[] }>(() => ({
  amount: centsToDecimal(amountCents.value ?? 0),
  lines: roots.value
    .map((r) => ({ iri: r.iri, cents: lineCents(r.iri) }))
    .filter((l): l is { iri: string; cents: number } => !!l.cents && !Number.isNaN(l.cents))
    .map((l) => ({ category: l.iri, amount: centsToDecimal(l.cents) })),
}))

// Fill the form once both the budget (or its absence) and the categories are known.
watch(
  [budget, tree],
  ([b, t]) => {
    if (initialPayload.value !== null || b === undefined || !t) return
    amountInput.value = b ? centsToInput(toCents(b.amount)) : ''
    const inputs: Record<string, string> = {}
    for (const line of b?.lines ?? []) {
      const iri = splitCategoryIri(line)
      if (iri) inputs[iri] = centsToInput(toCents(line.amount))
    }
    lineInputs.value = inputs
    initialPayload.value = JSON.stringify(payload.value)
  },
  { immediate: true },
)

const dirty = computed(() => initialPayload.value !== null && JSON.stringify(payload.value) !== initialPayload.value)

const canSave = computed(
  () =>
    !save.isPending.value &&
    dirty.value &&
    amountCents.value !== null &&
    amountCents.value > 0 &&
    !over.value &&
    roots.value.every((r) => !lineInvalid(r.iri)),
)

const error = ref<string | null>(null)
const savedNotice = ref(false)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

async function submit() {
  if (!canSave.value) return
  error.value = null
  try {
    const body = payload.value
    await save.mutateAsync({ budget: budget.value ?? null, ...body })
    initialPayload.value = JSON.stringify(body)
    savedNotice.value = true
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (savedNotice.value = false), 3000)
  } catch (e) {
    error.value = apiErrorStatus(e) === 403 ? "Vous n'avez pas le droit de modifier ce budget." : apiErrorMessage(e)
  }
}
onBeforeUnmount(() => clearTimeout(noticeTimer))

const loading = computed(() => budgetPending.value || treePending.value)
const loadError = computed(() => budgetError.value || treeError.value)

function retry() {
  if (budgetError.value) refetchBudget()
  if (treeError.value) refetchTree()
}
</script>

<template>
  <div class="min-h-dvh">
    <!-- Indigo band, the first card overlaps it -->
    <header class="h-32 bg-indigo-600 px-4 pt-8">
      <h1 class="text-xl font-bold text-white">Mon budget</h1>
    </header>

    <main class="-mt-12 flex flex-col gap-4 px-4 pb-44">
      <template v-if="loading">
        <div class="h-40 animate-pulse rounded-3xl bg-white shadow-sm" aria-hidden="true" />
        <div class="h-80 animate-pulse rounded-3xl bg-white shadow-sm" aria-hidden="true" />
      </template>

      <div v-else-if="loadError" class="flex items-center justify-between gap-3 rounded-3xl bg-rose-50 px-4 py-4 shadow-sm">
        <span class="text-sm text-rose-800">Impossible de charger votre budget.</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="retry">
          Réessayer
        </button>
      </div>

      <template v-else>
        <!-- Monthly amount -->
        <section class="rounded-3xl bg-white p-5 shadow-sm" aria-labelledby="budget-amount-label">
          <label id="budget-amount-label" for="budget-amount" class="text-[15px] font-semibold">Budget mensuel</label>
          <div
            class="mt-2 flex items-baseline gap-2 border-b-2 pb-1"
            :class="amountInvalid ? 'border-rose-300' : 'border-indigo-100 focus-within:border-indigo-400'"
          >
            <input
              id="budget-amount"
              v-model="amountInput"
              inputmode="decimal"
              autocomplete="off"
              placeholder="0"
              class="min-w-0 flex-1 bg-transparent text-5xl font-bold text-indigo-600 tabular-nums outline-none placeholder:text-indigo-200"
              :aria-invalid="amountInvalid"
              aria-describedby="budget-amount-help"
            />
            <span class="text-3xl font-bold text-indigo-400" aria-hidden="true">€</span>
          </div>
          <p v-if="amountInvalid" class="mt-2 text-[13px] text-rose-700">Montant invalide</p>
          <p id="budget-amount-help" class="mt-3 text-[13px] text-slate-500">
            Toutes dépenses confondues, hors virements internes.
          </p>
        </section>

        <!-- Split across categories -->
        <section class="rounded-3xl border border-slate-200 bg-white p-5" aria-labelledby="budget-split-title">
          <h2 id="budget-split-title" class="text-[15px] font-semibold">Répartition par catégorie</h2>
          <p
            class="mt-1 flex items-center gap-1.5 text-[13px] font-semibold"
            :class="over ? 'text-rose-700' : 'text-emerald-700'"
            aria-live="polite"
          >
            <component :is="over ? CircleAlert : CircleCheck" class="size-4 flex-none" aria-hidden="true" />
            <span>
              Réparti {{ formatCentsShort(allocated, currency) }} / {{ formatCentsShort(total, currency) }} ·
              <template v-if="over">dépasse de {{ formatCentsShort(allocated - total, currency) }}</template>
              <template v-else>reste {{ formatCentsShort(total - allocated, currency) }}</template>
            </span>
          </p>

          <ul class="mt-3 divide-y divide-slate-100">
            <li v-for="root in roots" :key="root.iri" class="py-3">
              <div class="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  class="flex size-10 flex-none items-center justify-center rounded-full bg-slate-100 text-lg"
                >
                  {{ root.emoji }}
                </span>
                <label :for="`line-${root.iri}`" class="min-w-0 flex-1 text-[15px] font-semibold">{{ root.label }}</label>
                <div class="relative w-28 flex-none">
                  <input
                    :id="`line-${root.iri}`"
                    v-model="lineInputs[root.iri]"
                    inputmode="decimal"
                    autocomplete="off"
                    placeholder="0"
                    class="min-h-12 w-full rounded-xl border bg-white pr-8 pl-3 text-right text-[17px] font-bold tabular-nums outline-none focus:ring-2"
                    :class="
                      lineInvalid(root.iri)
                        ? 'border-rose-300 focus:ring-rose-100'
                        : 'border-slate-300 focus:border-indigo-400 focus:ring-indigo-100'
                    "
                    :aria-invalid="lineInvalid(root.iri)"
                  />
                  <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">€</span>
                </div>
              </div>
              <p v-if="lineInvalid(root.iri)" class="mt-1 text-right text-xs text-rose-700">Montant invalide</p>
            </li>
          </ul>
        </section>
      </template>
    </main>

    <!-- Save bar, above the bottom nav -->
    <div
      v-if="!loading && !loadError"
      class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"
    >
      <p v-if="error" class="mb-2 text-sm text-rose-800" role="alert">{{ error }}</p>
      <p v-else-if="savedNotice" class="mb-2 text-sm font-semibold text-emerald-700" role="status">Budget enregistré</p>
      <button
        type="button"
        class="h-12 w-full rounded-full bg-indigo-600 text-[15px] font-semibold text-white disabled:opacity-40"
        :disabled="!canSave"
        @click="submit"
      >
        {{ save.isPending.value ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </div>
  </div>
</template>
