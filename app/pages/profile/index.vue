<script setup lang="ts">
import { ChevronRight, Landmark, Tags } from 'lucide-vue-next'

const { locale, locales, setLocale } = useI18n()
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader :title="$t('profile.title')" back="/" />

    <section class="flex flex-col gap-2" aria-labelledby="settings-title">
      <h2 id="settings-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {{ $t('profile.settings') }}
      </h2>
      <div class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <NuxtLink to="/profile/connections" class="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-slate-50">
          <Landmark class="size-5 flex-none text-slate-700" aria-hidden="true" />
          <span class="flex-1 text-[15px] font-medium">{{ $t('home.title') }}</span>
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </NuxtLink>
        <NuxtLink to="/profile/categories" class="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-slate-50">
          <Tags class="size-5 flex-none text-slate-700" aria-hidden="true" />
          <span class="flex-1 text-[15px] font-medium">{{ $t('profile.customCategories') }}</span>
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </NuxtLink>
      </div>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="language-title">
      <h2 id="language-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {{ $t('profile.language') }}
      </h2>
      <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-labelledby="language-title">
        <button
          v-for="l in locales"
          :key="l.code"
          type="button"
          role="radio"
          :lang="l.code"
          :aria-checked="locale === l.code"
          class="min-h-11 rounded-lg text-[15px] font-medium text-slate-600 aria-checked:bg-white aria-checked:font-semibold aria-checked:text-slate-900 aria-checked:shadow-sm"
          @click="setLocale(l.code)"
        >
          {{ l.name }}
        </button>
      </div>
    </section>
  </main>
</template>
