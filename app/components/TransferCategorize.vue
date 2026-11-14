<script setup lang="ts">
// "Transfert" tab of the categorize sheet: pick the other account, the category follows.
// - checking account -> transfer category ("Virements entre comptes"), full amount;
// - savings / investment account -> saving category ("Épargne"), full amount. A manual account gets
//   the mirror transaction (counterpartAccount); in another currency, the received amount is asked first.
import { Check, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { SplitInput } from '~/composables/useBankingQueries'
import type { Account, Transaction } from '~/types/api'
import type { CategoryTree } from '~/utils/categories'

const props = defineProps<{ transaction: Transaction; tree: CategoryTree; pending?: boolean }>()
const emit = defineEmits<{ save: [splits: SplitInput[]] }>()

const { data: allAccounts, isPending: accountsPending, isError: accountsError, refetch } = useAllAccountsQuery()

const amountCents = computed(() => toCents(props.transaction.amount))
const sign = computed(() => (amountCents.value < 0 ? -1 : 1))
const outgoing = computed(() => amountCents.value < 0)

// Other accounts: savings / investment first, then checking.
const ownHref = computed(() => props.transaction._links.account?.href)
const others = computed(() => (allAccounts.value ?? []).filter((a) => a._links.self.href !== ownHref.value))
const groups = computed(() =>
  [
    { id: 'saving', title: 'Épargne et placements', items: others.value.filter((a) => a.type !== 'checking') },
    { id: 'checking', title: 'Comptes courants', items: others.value.filter((a) => a.type === 'checking') },
  ].filter((g) => g.items.length),
)

const transferCategory = computed(
  () =>
    [...props.tree.byIri.values()].find((n) => n.code === 'internal.transfers') ??
    props.tree.roots.find((n) => n.type === 'transfer'),
)
const savingCategory = computed(() => props.tree.roots.find((n) => n.type === 'saving'))
const categoryFor = (a: Account) => (a.type === 'checking' ? transferCategory.value : savingCategory.value)

// Current state: the manual account of a saving split, or just a category (no account stored).
const splits = computed(() => props.transaction.splits ?? [])
const currentAccount = computed(() => splits.value.find((s) => s._links?.counterpartAccount)?._links?.counterpartAccount?.href)
const currentLabel = computed(() => {
  if (currentAccount.value) return null
  const iri = splits.value.map(splitCategoryIri).find((i) => {
    const type = i ? props.tree.byIri.get(i)?.type : undefined
    return type === 'transfer' || type === 'saving'
  })
  return iri ? props.tree.byIri.get(iri)?.fullLabel : null
})

/** Manual account in another currency: the amount received there is required. */
const otherCurrency = (a: Account) =>
  a.manual && a.balanceCurrency && a.balanceCurrency !== props.transaction.currency ? a.balanceCurrency : null

const converting = ref<Account | null>(null)
const received = ref('')
const receivedCents = computed(() => parseAmountInput(received.value))
watch(
  () => props.transaction,
  () => {
    converting.value = null
  },
)

function pickAccount(a: Account) {
  if (props.pending || !categoryFor(a)) return
  if (otherCurrency(a)) {
    converting.value = a
    received.value = ''
    return
  }
  save(a)
}

function save(a: Account, counterpartCents?: number) {
  const category = categoryFor(a)
  if (!category) return
  emit('save', [
    {
      category: category.iri,
      amount: props.transaction.amount,
      ...(a.type !== 'checking' && a.manual && { counterpartAccount: a._links.self.href }),
      ...(counterpartCents !== undefined && { counterpartAmount: centsToDecimal(-sign.value * counterpartCents) }),
    },
  ])
}

function saveConverted() {
  if (!converting.value || !receivedCents.value || props.pending) return
  save(converting.value, receivedCents.value)
}
</script>

<template>
  <!-- Manual account in another currency: amount received -->
  <form v-if="converting" class="flex flex-col gap-3" @submit.prevent="saveConverted">
    <button
      type="button"
      class="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-full pr-3 pl-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      @click="converting = null"
    >
      <ChevronLeft class="size-5" aria-hidden="true" /> Changer de compte
    </button>
    <p class="text-sm text-slate-600">
      {{ accountName(converting) }} est en {{ converting.balanceCurrency }}. Combien
      {{ outgoing ? 'a été reçu sur ce compte' : 'est sorti de ce compte' }} ?
    </p>
    <label class="relative">
      <span class="sr-only">Montant en {{ converting.balanceCurrency }}</span>
      <input
        v-model="received"
        inputmode="decimal"
        placeholder="0,00"
        autocomplete="off"
        class="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pr-14 pl-3 text-right text-[17px] font-semibold tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">
        {{ converting.balanceCurrency }}
      </span>
    </label>
    <p v-if="received && !receivedCents" class="text-xs text-rose-700">Montant invalide.</p>
    <button
      type="submit"
      class="min-h-11 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
      :disabled="!receivedCents || pending"
    >
      {{ pending ? 'Enregistrement…' : 'Enregistrer' }}
    </button>
  </form>

  <!-- Other account -->
  <div v-else class="flex flex-col gap-4">
    <p class="text-sm text-slate-600">
      {{ outgoing ? 'Vers quel compte va cet argent ?' : "D'où vient cet argent ?" }}
    </p>

    <p v-if="currentLabel" class="rounded-xl bg-indigo-50 px-3 py-2 text-[13px] text-indigo-800">
      Actuellement : {{ currentLabel }}.
    </p>

    <div v-if="accountsPending" class="flex flex-col gap-2" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-xl bg-slate-100" />
    </div>

    <div v-else-if="accountsError" class="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2">
      <span class="text-sm text-rose-800">Impossible de charger vos comptes.</span>
      <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetch()">Réessayer</button>
    </div>

    <p v-else-if="!groups.length" class="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
      Aucun autre compte. Ajoute un compte manuel (Livret A, PEA…) depuis ton profil.
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
            :disabled="pending || !categoryFor(a)"
            @click="pickAccount(a)"
          >
            <AccountTypeIcon v-if="a.manual" :type="a.type" small />
            <BankLogo v-else :href="a._links.bank?.href" class="size-8! rounded-lg! text-[11px]!" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[15px] font-medium">{{ accountName(a) }}</span>
              <span class="text-xs text-slate-500">
                {{ ACCOUNT_TYPE_LABELS[a.type] }}<template v-if="a.iban"> · {{ maskIban(a.iban) }}</template>
              </span>
            </span>
            <Check v-if="a._links.self.href === currentAccount" class="size-5 text-indigo-600" aria-label="Sélectionné" />
            <ChevronRight v-else-if="otherCurrency(a)" class="size-4 flex-none text-slate-400" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
