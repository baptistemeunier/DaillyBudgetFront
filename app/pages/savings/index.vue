<script setup lang="ts">
import { CircleUserRound, Plus } from 'lucide-vue-next'

definePageMeta({ tabs: true })

const MONTHS = 6
const thisMonth = currentMonth()

// Last 6 months for the chart; this month alone for the envelopes ("ce mois") and what's left to allocate.
const { data: history, isPending: historyPending, isError: historyError, refetch: refetchHistory } =
  useSavingStatementQuery(periodOf(thisMonth, MONTHS))
const { data: month, isPending: monthPending, isError: monthError, refetch: refetchMonth } =
  useSavingStatementQuery(thisMonth)
const { data: tree } = useCategoriesQuery()
const { data: accounts } = useAllAccountsQuery()

const currency = computed(() => history.value?.currency ?? month.value?.currency ?? 'EUR')

// Headline: net over the 6 months
const credit = computed(() => (history.value ? toCents(history.value.creditAmount) : 0))
const debit = computed(() => (history.value ? toCents(history.value.debitAmount) : 0))
const net = computed(() => credit.value - debit.value)
const average = computed(() => Math.round(net.value / (history.value?.months || MONTHS)))
const currentNet = computed(() => {
  const m = history.value?.monthly.find((x) => x.month === thisMonth)
  return m ? toCents(m.creditAmount) - toCents(m.debitAmount) : 0
})

const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${thisMonth}-15T12:00:00Z`))
const leftToAllocate = computed(() => (month.value ? toCents(month.value.uncategorizedAmount) : 0))

// Envelopes: the sub-categories of Épargne (the root itself isn't one).
const envelopes = computed(() =>
  (month.value?.envelopes ?? [])
    .map((envelope) => {
      const iri = splitCategoryIri(envelope) ?? ''
      const node = tree.value?.byIri.get(iri)
      const name = node?.label ?? 'Enveloppe supprimée'
      // Its own icon, else one suggested from the name (envelopes created before icons).
      const icon = (node?.iconName && categoryIcon(node.iconName)) || categoryIcon(suggestEnvelopeIcon(name))!
      return { envelope, iri, node, name, icon }
    })
    .filter((e) => !(e.node && e.node.type === 'saving' && !e.node.parentIri)),
)
const envelopesTotal = computed(() => envelopes.value.reduce((sum, e) => sum + toCents(e.envelope.amount), 0))

// The money stays on the savings accounts: show where, and what no envelope holds.
const savingAccounts = computed(() => (accounts.value ?? []).filter((a) => a.type !== 'checking'))
const savingBalance = computed(() =>
  savingAccounts.value
    .filter((a) => a.balance != null && (a.balanceCurrency ?? 'EUR') === currency.value)
    .reduce((sum, a) => sum + toCents(a.balance!), 0),
)
const savingNames = computed(() => {
  const names = savingAccounts.value.map(accountName)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`
})

// Envelope sheet: create (iri null) or edit an envelope's name and target.
const savingRoot = computed(() => tree.value?.roots.find((r) => r.type === 'saving'))
const sheetOpen = ref(false)
const sheetIri = ref<string | null>(null)
function openSheet(iri: string | null) {
  sheetIri.value = iri
  sheetOpen.value = true
}
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-24">
    <PageHeader title="Épargne">
      <template #leading>
        <NuxtLink
          to="/profile"
          class="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-100"
          aria-label="Mon profil"
        >
          <CircleUserRound class="size-6" />
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- 6 months -->
    <section class="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5" aria-labelledby="saved-title">
      <div v-if="historyPending" class="flex flex-col gap-3" aria-hidden="true">
        <div class="h-4 w-32 animate-pulse rounded bg-slate-100" />
        <div class="h-9 w-48 animate-pulse rounded bg-slate-100" />
        <div class="h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <div v-else-if="historyError || !history" class="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2">
        <span class="text-sm text-rose-800">Impossible de charger ton épargne.</span>
        <button type="button" class="min-h-11 font-semibold text-rose-800" @click="refetchHistory()">Réessayer</button>
      </div>

      <template v-else>
        <div class="flex flex-col gap-1">
          <h2 id="saved-title" class="text-[13px] text-slate-500">Épargné sur {{ history.months }} mois</h2>
          <p
            class="text-[34px] leading-tight font-bold tabular-nums"
            :class="net > 0 ? 'text-emerald-700' : net < 0 ? 'text-rose-700' : 'text-slate-900'"
          >
            {{ formatSignedCents(net, currency) }}
          </p>
          <p class="text-[13px] text-slate-500">
            Entrées − sorties · en moyenne {{ formatCents(average, currency) }} par mois
          </p>
        </div>

        <SavingMonthsChart :months="history.monthly" :currency="currency" :current="thisMonth" />

        <dl class="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
          <div class="flex flex-col gap-0.5">
            <dt class="text-[13px] text-slate-500">Entrées</dt>
            <dd class="text-[15px] font-semibold tabular-nums">{{ formatCents(credit, currency) }}</dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-[13px] text-slate-500">Sorties</dt>
            <dd class="text-[15px] font-semibold tabular-nums">{{ formatCents(debit, currency) }}</dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-[13px] text-slate-500">Épargné (en cours)</dt>
            <dd
              class="text-[15px] font-semibold tabular-nums"
              :class="currentNet > 0 ? 'text-emerald-700' : currentNet < 0 ? 'text-rose-700' : ''"
            >
              {{ formatSignedCents(currentNet, currency) }}
            </dd>
          </div>
        </dl>
      </template>
    </section>

    <!-- Left to allocate (this month) -->
    <section
      v-if="leftToAllocate > 0"
      class="flex flex-col gap-2 rounded-3xl bg-indigo-600 p-5 text-white shadow-lg shadow-indigo-200"
      aria-labelledby="allocate-title"
    >
      <h2 id="allocate-title" class="text-[13px] text-indigo-100">Reste à répartir — {{ monthName }}</h2>
      <p class="text-[30px] leading-tight font-bold tabular-nums">{{ formatCents(leftToAllocate, currency) }}</p>
      <p class="text-[13px] text-indigo-100">Une partie de ton épargne de {{ monthName }} n'est dans aucune enveloppe.</p>
      <NuxtLink
        to="/transactions/to-categorize?accounts=savings"
        class="mt-2 inline-flex min-h-12 items-center self-start rounded-full bg-white px-5 text-[15px] font-semibold text-indigo-700"
      >
        Répartir dans mes enveloppes
      </NuxtLink>
    </section>

    <!-- Envelopes -->
    <section class="flex flex-col gap-3" aria-labelledby="envelopes-title">
      <div class="flex items-baseline justify-between">
        <h2 id="envelopes-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Mes enveloppes</h2>
        <span v-if="month" class="text-[15px] font-semibold tabular-nums">{{ formatCents(envelopesTotal, currency) }}</span>
      </div>

      <template v-if="monthPending">
        <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-hidden="true" />
      </template>

      <div v-else-if="monthError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">Impossible de charger tes enveloppes.</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetchMonth()">
          Réessayer
        </button>
      </div>

      <template v-else>
        <EnvelopeCard
          v-for="e in envelopes"
          :key="e.iri"
          :envelope="e.envelope"
          :iri="e.iri"
          :icon="e.icon"
          :name="e.name"
          :currency="currency"
          :editable="!!tree?.byIri.get(e.iri)"
          @edit="openSheet(e.iri)"
        />
      </template>

      <button
        type="button"
        class="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 text-[15px] font-semibold text-indigo-700 disabled:opacity-50"
        :disabled="!savingRoot"
        @click="openSheet(null)"
      >
        <Plus class="size-5" aria-hidden="true" /> Nouvelle enveloppe
      </button>

      <p v-if="savingAccounts.length && month" class="text-[13px] text-slate-500">
        Les enveloppes sont virtuelles : l'argent reste sur tes comptes d'épargne ({{ savingNames }},
        {{ formatCents(savingBalance, currency) }}). Non affecté : {{ formatCents(savingBalance - envelopesTotal, currency) }}.
      </p>
    </section>

    <EnvelopeSheet :iri="sheetIri" :open="sheetOpen" :currency="currency" @close="sheetOpen = false" />
  </main>
</template>
