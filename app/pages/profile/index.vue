<script setup lang="ts">
import { ChevronRight, Landmark } from 'lucide-vue-next'
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader title="Mon profil" back="/" />

    <section class="flex flex-col gap-2" aria-labelledby="settings-title">
      <h2 id="settings-title" class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Paramètres</h2>
      <div class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <NuxtLink to="/profile/connections" class="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-slate-50">
          <Landmark class="size-5 flex-none text-slate-700" aria-hidden="true" />
          <span class="flex-1 text-[15px] font-medium">Mes comptes</span>
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
