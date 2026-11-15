<script setup lang="ts">
// A settings row with a label, a hint and an on / off switch (role="switch").
defineProps<{ label: string; hint?: string; checked: boolean; disabled?: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="checked"
    class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-wait"
    :disabled="disabled"
    @click="$emit('toggle')"
  >
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-[15px] font-medium">{{ label }}</span>
      <span v-if="hint" class="text-[13px] text-slate-500">{{ hint }}</span>
    </span>
    <span class="relative h-6 w-10 flex-none rounded-full transition-colors" :class="checked ? 'bg-indigo-600' : 'bg-slate-300'" aria-hidden="true">
      <span class="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform" :class="checked ? 'translate-x-4' : ''" />
    </span>
  </button>
</template>
