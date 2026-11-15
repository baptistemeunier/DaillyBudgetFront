<script setup lang="ts">
// Grid of the category icons to choose from (Lucide names).
const model = defineModel<string>({ required: true })
defineProps<{ label?: string }>()
const emit = defineEmits<{ picked: [] }>()

function pick(name: string) {
  model.value = name
  emit('picked')
}
</script>

<template>
  <div
    class="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5"
    role="radiogroup"
    :aria-label="label ?? $t('common.icon')"
  >
    <button
      v-for="name in CATEGORY_ICON_CHOICES"
      :key="name"
      type="button"
      role="radio"
      :aria-checked="model === name"
      :aria-label="name"
      :title="name"
      class="flex aspect-square items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 aria-checked:bg-indigo-600 aria-checked:text-white"
      @click="pick(name)"
    >
      <component :is="categoryIcon(name)" class="size-5" />
    </button>
  </div>
</template>
