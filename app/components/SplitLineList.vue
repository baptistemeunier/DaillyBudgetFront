<script setup lang="ts">
// Split lines (category button + amount + delete) and "Ajouter une ligne", see useSplitLines.
// The category is chosen by the parent (it swaps the list for a CategoryPicker on `pick`).
import { Plus, Trash2 } from 'lucide-vue-next'
import type { SplitLine } from '~/composables/useSplitLines'
import type { CategoryTree } from '~/utils/categories'

const lines = defineModel<SplitLine[]>({ required: true })
defineProps<{ tree: CategoryTree; errors: (string | null)[] }>()
defineEmits<{ pick: [index: number]; remove: [index: number]; add: [] }>()
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li v-for="(line, index) in lines" :key="line.key" class="flex flex-col gap-1 rounded-2xl border border-slate-200 p-2">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left hover:bg-slate-50"
          @click="$emit('pick', index)"
        >
          <component
            :is="(line.category && tree.byIri.get(line.category)?.icon) || UNCATEGORIZED_ICON"
            class="size-5 flex-none"
            :class="line.category ? categoryTint(tree.byIri.get(line.category), tree).icon.class : 'text-slate-600'"
            :style="line.category ? categoryTint(tree.byIri.get(line.category), tree).icon.style : undefined"
            aria-hidden="true"
          />
          <span class="truncate text-[15px]" :class="line.category ? 'font-medium' : 'text-slate-500'">
            {{ line.category ? (tree.byIri.get(line.category)?.fullLabel ?? $t('common.category')) : $t('categorize.chooseCategory') }}
          </span>
        </button>
        <label class="relative w-28 flex-none">
          <span class="sr-only">{{ $t('common.amount') }}</span>
          <input
            v-model="line.input"
            inputmode="decimal"
            :placeholder="$t('common.amountPlaceholder')"
            class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-7 pl-3 text-right text-[15px] tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">€</span>
        </label>
        <button
          type="button"
          class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-700"
          :aria-label="$t('categorize.removeLine')"
          @click="$emit('remove', index)"
        >
          <Trash2 class="size-5" />
        </button>
      </div>
      <p v-if="errors[index] && (line.category || line.input)" class="px-2 text-xs text-rose-700">
        {{ errors[index] }}
      </p>
    </li>
  </ul>

  <button
    type="button"
    class="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700"
    @click="$emit('add')"
  >
    <Plus class="size-5" aria-hidden="true" /> {{ $t('categorize.addLine') }}
  </button>
</template>
