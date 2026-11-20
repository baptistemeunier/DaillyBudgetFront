<script setup lang="ts">
// The categorization rules ("always categorize like this"), shared by all the users: create, edit, delete
// (only the owner of a rule deletes it: the API gives _links.delete to them only).
// Created here or from the "Toujours pour …" switch of CategorizeSheet.
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import type { CategorizationRule } from '~/types/api'

const { data: rules, isPending, isError, refetch } = useCategorizationRulesQuery()
const { data: tree } = useCategoriesQuery()

const categoryOf = (rule: CategorizationRule) => {
  const iri = ruleCategoryIri(rule)
  return iri ? tree.value?.byIri.get(iri) : undefined
}

// Rule sheet
const sheet = reactive({ open: false, rule: null as CategorizationRule | null })
function openRule(rule: CategorizationRule | null) {
  Object.assign(sheet, { open: true, rule })
}

// Deletion
const remove = useDeleteCategorizationRule()
const toDelete = ref<CategorizationRule | null>(null)
const deleteOpen = ref(false)
function askDelete(rule: CategorizationRule) {
  remove.reset()
  toDelete.value = rule
  deleteOpen.value = true
}
async function confirmDelete() {
  if (!toDelete.value) return
  try {
    await remove.mutateAsync(toDelete.value._links.self.href)
    deleteOpen.value = false
  } catch {
    // Shown in the dialog
  }
}
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader :title="$t('rules.title')" back="/profile" />

    <p v-if="isPending" class="py-8 text-center text-sm text-slate-500">{{ $t('common.loading') }}</p>
    <div v-else-if="isError" class="flex flex-col items-center gap-3 py-8">
      <p class="text-sm text-slate-600">{{ $t('common.loadInterrupted') }}</p>
      <button type="button" class="min-h-11 rounded-full px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50" @click="refetch()">
        {{ $t('common.retry') }}
      </button>
    </div>

    <template v-else>
      <p class="text-sm text-slate-600">{{ rules?.length ? $t('rules.intro') : $t('rules.empty') }}</p>

      <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <li v-for="rule in rules" :key="rule._links.self.href" class="flex min-h-14 items-center gap-2 pr-2 pl-3">
          <component :is="categoryOf(rule)?.icon ?? UNCATEGORIZED_ICON" class="size-5 flex-none text-slate-500" aria-hidden="true" />
          <span class="flex min-w-0 flex-1 flex-col py-2">
            <span class="truncate text-[15px] font-medium">{{ rule.pattern }}</span>
            <span class="truncate text-xs text-slate-500">
              {{ $t(`rules.direction.${rule.direction ?? 'both'}`) }} → {{ categoryOf(rule)?.fullLabel ?? '…' }}
            </span>
          </span>
          <button
            type="button"
            class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            :aria-label="$t('rules.editNamed', { name: rule.pattern })"
            @click="openRule(rule)"
          >
            <Pencil class="size-4" />
          </button>
          <button
            v-if="rule._links.delete"
            type="button"
            class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            :aria-label="$t('rules.deleteNamed', { name: rule.pattern })"
            @click="askDelete(rule)"
          >
            <Trash2 class="size-4" />
          </button>
        </li>
        <li>
          <button
            type="button"
            class="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[15px] font-semibold text-indigo-700 hover:bg-indigo-50"
            @click="openRule(null)"
          >
            <Plus class="size-4" aria-hidden="true" />
            {{ $t('rules.add') }}
          </button>
        </li>
      </ul>
    </template>

    <RuleSheet :rule="sheet.rule" :open="sheet.open" @close="sheet.open = false" />

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="$t('rules.deleteTitle', { name: toDelete?.pattern ?? '' })"
      :confirm-label="$t('common.delete')"
      tone="danger"
      :icon="Trash2"
      :pending="remove.isPending.value"
      :error="remove.isError.value ? $t('errors.deleteFailedRetry') : null"
      @confirm="confirmDelete"
    >
      <p>{{ $t('rules.deleteText') }}</p>
    </ConfirmDialog>
  </main>
</template>
