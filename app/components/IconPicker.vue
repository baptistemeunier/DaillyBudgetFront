<script setup lang="ts">
// Icon button of a category: shows the current icon, a tap toggles the grid (rendered by the parent
// with <IconGrid> under the line, so the button can sit next to the name field).
const model = defineModel<string>({ required: true })
const open = defineModel<boolean>('open', { default: false })
defineProps<{ controls?: string }>()

const current = computed(() => categoryIcon(model.value) ?? DEFAULT_CATEGORY_ICON)
</script>

<template>
  <button
    type="button"
    class="flex size-11 flex-none items-center justify-center rounded-xl border bg-white text-slate-700 hover:bg-slate-50"
    :class="open ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'"
    :aria-expanded="open"
    :aria-controls="controls"
    aria-label="Changer l'icône"
    @click="open = !open"
  >
    <component :is="current" class="size-5" />
  </button>
</template>
