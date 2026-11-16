<script setup lang="ts">
// "Transfert" tab of the categorize sheet: pick the other account, the category follows.
// - checking account -> transfer category (internal.transfers), full amount;
// - savings / investment account -> then pick the envelope (a sub-category of the saving root: the API refuses
//   a root), full amount. A manual account gets the mirror transaction (counterpartAccount);
//   in another currency, the received amount is asked last.
//   Same currency: "Répartir sur plusieurs enveloppes" gives one split (and one mirror) per envelope.
import { Check, ChevronLeft, ChevronRight, Split } from 'lucide-vue-next'
import type { SplitInput } from '~/composables/useBankingQueries'
import type { Account, Transaction } from '~/types/api'
import type { CategoryTree } from '~/utils/categories'

const props = defineProps<{ transaction: Transaction; tree: CategoryTree; pending?: boolean }>()
const emit = defineEmits<{ save: [splits: SplitInput[]] }>()
const { t } = useI18n()

const { data: allAccounts, isPending: accountsPending, isError: accountsError, refetch } = useAllAccountsQuery()

const amountCents = computed(() => toCents(props.transaction.amount))
const sign = computed(() => (amountCents.value < 0 ? -1 : 1))
const outgoing = computed(() => amountCents.value < 0)

// Other accounts: savings / investment first, then checking.
const ownHref = computed(() => props.transaction._links.account?.href)
const others = computed(() => (allAccounts.value ?? []).filter((a) => a._links.self.href !== ownHref.value))
const groups = computed(() =>
  [
    { id: 'saving', title: t('transfer.savingGroup'), items: others.value.filter((a) => a.type !== 'checking') },
    { id: 'checking', title: accountScopeLabel('checking'), items: others.value.filter((a) => a.type === 'checking') },
  ].filter((g) => g.items.length),
)

// Sub-categories only (the API refuses a root on a split).
const transferCategory = computed(
  () =>
    [...props.tree.byIri.values()].find((n) => n.code === 'internal.transfers') ??
    props.tree.roots.find((n) => n.type === 'transfer')?.children[0],
)
const hasSavingRoot = computed(() => props.tree.roots.some((n) => n.type === 'saving'))
const canPick = (a: Account) => (a.type === 'checking' ? !!transferCategory.value : hasSavingRoot.value)

// Current state: the manual account of a saving split, or just a category (no account stored).
const splits = computed(() => props.transaction.splits ?? [])
const currentAccount = computed(() => splits.value.find((s) => s._links?.counterpartAccount)?._links?.counterpartAccount?.href)
const currentEnvelope = computed(() =>
  splits.value.map(splitCategoryIri).find((i) => !!i && props.tree.byIri.get(i)?.type === 'saving'),
)
const currentLabel = computed(() => {
  if (currentAccount.value && savingSplits.value.length < 2) return null
  const labels = splits.value
    .map(splitCategoryIri)
    .map((i) => (i ? props.tree.byIri.get(i) : undefined))
    .filter((n) => n?.type === 'transfer' || n?.type === 'saving')
    .map((n) => (savingSplits.value.length > 1 ? n!.label : n!.fullLabel))
  return labels.length ? labels.join(', ') : null
})
const savingSplits = computed(() =>
  splits.value.filter((s) => {
    const iri = splitCategoryIri(s)
    return !!iri && props.tree.byIri.get(iri)?.type === 'saving'
  }),
)

/** Manual account in another currency: the amount received there is required. */
const otherCurrency = (a: Account) =>
  a.manual && a.balanceCurrency && a.balanceCurrency !== props.transaction.currency ? a.balanceCurrency : null

// Savings account chosen -> envelope -> (other currency) amount received.
const chosen = ref<Account | null>(null)
const envelope = ref<string | null>(null)
const received = ref('')
const receivedCents = computed(() => parseAmountInput(received.value))
const converting = computed(() => (chosen.value && envelope.value && otherCurrency(chosen.value) ? chosen.value : null))

// Several envelopes (same currency only: one received amount per envelope isn't asked).
const multi = ref(false)
const absAmount = computed(() => Math.abs(amountCents.value))
const { lines, picking, remaining, usedIris, lineErrors, isValid, reset, addLine, removeLine, pickForLine, toSplits } =
  useSplitLines(absAmount)

watch(
  () => props.transaction,
  () => {
    chosen.value = null
    envelope.value = null
    multi.value = false
    reset()
  },
)

function startMulti() {
  multi.value = true
  reset()
  addLine()
}

function saveMulti() {
  const a = chosen.value
  if (!a || !isValid.value || !lines.value.length || props.pending) return
  emit('save', toSplits(sign.value, a.manual ? { counterpartAccount: a._links.self.href } : {}))
}

function pickAccount(a: Account) {
  if (props.pending || !canPick(a)) return
  if (a.type === 'checking') {
    emit('save', [{ category: transferCategory.value!.iri, amount: props.transaction.amount }])
    return
  }
  chosen.value = a
  envelope.value = null
  received.value = ''
  // Already spread over several envelopes (of this account): reopen the lines.
  multi.value = savingSplits.value.length > 1 && (!currentAccount.value || currentAccount.value === a._links.self.href)
  if (multi.value) reset(savingSplits.value.map((s) => ({ category: splitCategoryIri(s), cents: toCents(s.amount) })))
  else reset()
}

function pickEnvelope(iri: string) {
  if (!chosen.value || props.pending) return
  envelope.value = iri
  if (!otherCurrency(chosen.value)) saveSaving()
}

function saveSaving(counterpartCents?: number) {
  const a = chosen.value
  if (!a || !envelope.value) return
  emit('save', [
    {
      category: envelope.value,
      amount: props.transaction.amount,
      ...(a.manual && { counterpartAccount: a._links.self.href }),
      ...(counterpartCents !== undefined && { counterpartAmount: centsToDecimal(-sign.value * counterpartCents) }),
    },
  ])
}

function saveConverted() {
  if (!converting.value || !receivedCents.value || props.pending) return
  saveSaving(receivedCents.value)
}
</script>

<template>
  <!-- Manual account in another currency: amount received -->
  <form v-if="converting" class="flex flex-col gap-3" @submit.prevent="saveConverted">
    <button
      type="button"
      class="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-full pr-3 pl-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      @click="envelope = null"
    >
      <ChevronLeft class="size-5" aria-hidden="true" /> {{ $t('transfer.changeEnvelope') }}
    </button>
    <p class="text-sm text-slate-600">
      {{
        $t(outgoing ? 'transfer.receivedQuestion' : 'transfer.sentQuestion', {
          account: accountName(converting),
          currency: converting.balanceCurrency,
        })
      }}
    </p>
    <label class="relative">
      <span class="sr-only">{{ $t('transfer.amountIn', { currency: converting.balanceCurrency }) }}</span>
      <input
        v-model="received"
        inputmode="decimal"
        :placeholder="$t('common.amountPlaceholder')"
        autocomplete="off"
        class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pr-14 pl-3 text-right text-[17px] font-semibold tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">
        {{ converting.balanceCurrency }}
      </span>
    </label>
    <p v-if="received && !receivedCents" class="text-xs text-rose-700">{{ $t('common.invalidAmountSentence') }}</p>
    <button
      type="submit"
      class="min-h-11 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
      :disabled="!receivedCents || pending"
    >
      {{ pending ? $t('common.saving') : $t('common.save') }}
    </button>
  </form>

  <!-- Several envelopes: category of a line -->
  <div v-else-if="chosen && multi && picking !== null" class="flex flex-col gap-3">
    <button
      type="button"
      class="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-full pr-3 pl-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      @click="picking = null"
    >
      <ChevronLeft class="size-5" aria-hidden="true" /> {{ $t('common.back') }}
    </button>
    <CategoryPicker
      :tree="tree"
      :types="['saving']"
      :selected="lines[picking]?.category ? [lines[picking]!.category!] : []"
      :disabled="usedIris"
      @pick="pickForLine"
    />
  </div>

  <!-- Several envelopes: lines -->
  <div v-else-if="chosen && multi" class="flex flex-col gap-3">
    <button
      type="button"
      class="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-full pr-3 pl-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      @click="chosen = null"
    >
      <ChevronLeft class="size-5" aria-hidden="true" /> {{ $t('transfer.changeAccount') }}
    </button>
    <p class="text-sm text-slate-600">
      {{ $t(outgoing ? 'transfer.envelopesIn' : 'transfer.envelopesOut', { account: accountName(chosen) }) }}
    </p>
    <div>
      <SplitLineList
        v-model="lines"
        :tree="tree"
        :errors="lineErrors"
        @pick="picking = $event"
        @remove="removeLine"
        @add="addLine"
      />
    </div>
    <div class="flex items-center justify-between gap-3">
      <p class="text-[13px]" aria-live="polite">
        <span v-if="remaining < 0" class="font-semibold text-rose-700">
          {{ $t('categorize.over', { amount: formatCents(-remaining, transaction.currency) }) }}
        </span>
        <template v-else>
          <span class="text-slate-500">{{ $t('categorize.uncategorizedRemaining') }} </span>
          <span class="font-semibold tabular-nums" :class="remaining === 0 ? 'text-emerald-700' : 'text-amber-700'">
            {{ formatCents(remaining, transaction.currency) }}
          </span>
        </template>
      </p>
      <button
        type="button"
        class="min-h-11 flex-none rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
        :disabled="!isValid || !lines.length || pending"
        @click="saveMulti"
      >
        {{ pending ? $t('common.saving') : $t('common.save') }}
      </button>
    </div>
    <button
      type="button"
      class="min-h-11 self-center rounded-full px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      @click="multi = false"
    >
      {{ $t('transfer.singleEnvelope') }}
    </button>
  </div>

  <!-- Envelope of the savings account -->
  <div v-else-if="chosen" class="flex flex-col gap-3">
    <button
      type="button"
      class="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-full pr-3 pl-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      @click="chosen = null"
    >
      <ChevronLeft class="size-5" aria-hidden="true" /> {{ $t('transfer.changeAccount') }}
    </button>
    <p class="text-sm text-slate-600">
      {{ $t(outgoing ? 'transfer.envelopeIn' : 'transfer.envelopeOut', { account: accountName(chosen) }) }}
    </p>
    <CategoryPicker
      :tree="tree"
      :types="['saving']"
      :selected="currentEnvelope ? [currentEnvelope] : []"
      :busy="pending"
      @pick="pickEnvelope"
    />
    <button
      v-if="!otherCurrency(chosen)"
      type="button"
      class="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700"
      @click="startMulti"
    >
      <Split class="size-5" aria-hidden="true" /> {{ $t('transfer.splitEnvelopes') }}
    </button>
  </div>

  <!-- Other account -->
  <div v-else class="flex flex-col gap-4">
    <p class="text-sm text-slate-600">
      {{ outgoing ? $t('transfer.accountTo') : $t('transfer.accountFrom') }}
    </p>

    <p v-if="currentLabel" class="rounded-xl bg-indigo-50 px-3 py-2 text-[13px] text-indigo-800">
      {{ $t('transfer.current', { label: currentLabel }) }}
    </p>

    <div v-if="accountsPending" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-xl bg-slate-100" />
    </div>

    <div v-else-if="accountsError" class="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2">
      <span class="text-sm text-rose-800">{{ $t('errors.loadYourAccounts') }}</span>
      <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetch()">{{ $t('common.retry') }}</button>
    </div>

    <p v-else-if="!groups.length" class="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
      {{ $t('transfer.noOther') }}
    </p>

    <section
      v-for="group in groups"
      v-else
      :key="group.id"
      class="flex flex-col gap-2"
      :aria-labelledby="`transfer-${group.id}`"
    >
      <h3 :id="`transfer-${group.id}`" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {{ group.title }}
      </h3>
      <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        <li v-for="a in group.items" :key="a._links.self.href">
          <button
            type="button"
            class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
            :disabled="pending || !canPick(a)"
            @click="pickAccount(a)"
          >
            <AccountTypeIcon v-if="a.manual" :type="a.type" small />
            <BankLogo v-else :href="a._links.bank?.href" class="size-8! rounded-lg! text-[11px]!" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[15px] font-medium">{{ accountName(a) }}</span>
              <span class="text-xs text-slate-500">
                {{ accountTypeLabel(a.type) }}<template v-if="a.iban"> · {{ maskIban(a.iban) }}</template>
              </span>
            </span>
            <Check v-if="a._links.self.href === currentAccount" class="size-5 text-indigo-600" :aria-label="$t('common.selectedAccount')" />
            <ChevronRight v-else-if="a.type !== 'checking'" class="size-4 flex-none text-slate-400" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
