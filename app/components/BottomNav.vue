<script setup lang="ts">
import { ChartPie, House, PiggyBank } from 'lucide-vue-next'

const tabs = [
  { to: '/', label: 'nav.accounts', icon: House },
  { to: '/budget', label: 'nav.budget', icon: ChartPie },
  { to: '/savings', label: 'nav.savings', icon: PiggyBank },
]
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
    :aria-label="$t('nav.label')"
  >
    <ul class="grid h-16 grid-cols-3">
      <li v-for="tab in tabs" :key="tab.to">
        <NuxtLink
          :to="tab.to"
          class="flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-500"
          exact-active-class="!text-indigo-600"
        >
          <component :is="tab.icon" class="size-6" aria-hidden="true" />
          {{ $t(tab.label) }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
