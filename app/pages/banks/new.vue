<script setup lang="ts">
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-vue-next'
import type { Bank } from '~/types/api'

const route = useRoute()
const router = useRouter()

// Step is driven by ?country= so the browser back button works.
const country = computed(() => (typeof route.query.country === 'string' ? route.query.country : undefined))
// Names and order follow the language.
const countries = computed(() => bankCountries())

const { data: banks, isPending, isError, refetch } = useBanksQuery(country)

const search = ref('')
watch(country, () => (search.value = ''))

const filtered = computed(() => {
  const q = normalizeSearch(search.value)
  return q ? (banks.value ?? []).filter((b) => normalizeSearch(b.name).includes(q)) : (banks.value ?? [])
})

const logoFailed = ref(new Set<string>())

const create = useCreateConnection()
const selected = ref<string | null>(null)

async function choose(bank: Bank) {
  if (create.isPending.value) return
  selected.value = bank.id
  try {
    const connection = await create.mutateAsync(bank.id)
    const href = connection._links.configure?.href
    if (!href) throw new Error('Lien de consentement absent')
    window.location.assign(href)
  } catch {
    selected.value = null
  }
}

function back() {
  if (country.value) router.push({ query: {} })
  else router.push('/')
}
</script>

<template>
  <main class="flex min-h-dvh flex-col">
    <header class="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white px-4 pt-4 pb-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-100"
          :aria-label="$t('common.back')"
          @click="back"
        >
          <ChevronLeft class="size-5" />
        </button>
        <div class="flex min-w-0 flex-col">
          <h1 class="text-lg font-bold">{{ $t('banks.add') }}</h1>
          <p class="truncate text-[13px] text-slate-500">
            {{ country ? countryName(country) : $t('banks.chooseCountry') }}
          </p>
        </div>
      </div>

      <label v-if="country" class="relative block">
        <span class="sr-only">{{ $t('banks.search') }}</span>
        <Search class="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
        <input
          v-model="search"
          type="search"
          :placeholder="$t('banks.search')"
          autocomplete="off"
          class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-11 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </label>
    </header>

    <!-- Step 1: country -->
    <ul v-if="!country" class="m-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <li v-for="c in countries" :key="c.code">
        <NuxtLink :to="{ query: { country: c.code } }" class="flex min-h-14 items-center gap-3 px-4 hover:bg-slate-50">
          <span class="text-xl" aria-hidden="true">{{ c.flag }}</span>
          <span class="flex-1 text-[15px] font-medium">{{ c.name }}</span>
          <ChevronRight class="size-4 text-slate-400" aria-hidden="true" />
        </NuxtLink>
      </li>
    </ul>

    <!-- Step 2: bank -->
    <section v-else class="flex flex-col gap-3 p-4">
      <p v-if="create.isError.value" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {{ $t('banks.createFailed') }}
      </p>

      <div v-if="isPending" class="flex flex-col gap-2" aria-hidden="true">
        <div v-for="i in 6" :key="i" class="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>

      <div v-else-if="isError" class="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3">
        <span class="text-sm text-rose-800">{{ $t('errors.loadBanks') }}</span>
        <button type="button" class="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white" @click="refetch()">
          {{ $t('common.retry') }}
        </button>
      </div>

      <template v-else>
        <p class="text-[13px] text-slate-500" aria-live="polite">
          {{ $t('banks.count', filtered.length) }}
        </p>

        <p v-if="!filtered.length" class="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
          {{ $t('banks.noMatch', { search }) }}
        </p>

        <ul v-else class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <li v-for="bank in filtered" :key="bank.id">
            <button
              type="button"
              class="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60"
              :disabled="create.isPending.value"
              @click="choose(bank)"
            >
              <img
                v-if="bank.logo && !logoFailed.has(bank.id)"
                :src="bank.logo"
                alt=""
                loading="lazy"
                class="size-10 flex-none rounded-xl border border-slate-100 object-contain"
                @error="logoFailed.add(bank.id)"
              />
              <span
                v-else
                aria-hidden="true"
                class="flex size-10 flex-none items-center justify-center rounded-xl bg-indigo-100 text-[13px] font-bold text-indigo-700"
              >
                {{ initials(bank.name) }}
              </span>
              <span class="min-w-0 flex-1 truncate text-[15px] font-medium">{{ bank.name }}</span>
              <Loader2 v-if="selected === bank.id" class="size-5 flex-none animate-spin text-indigo-600" />
              <ChevronRight v-else class="size-4 flex-none text-slate-400" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </template>
    </section>
  </main>
</template>
