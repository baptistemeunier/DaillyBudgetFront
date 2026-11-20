<script setup lang="ts">
// The users' categories (sub-categories of system roots) and saving envelopes, shared by all the users:
// create, edit, delete (only the owner deletes: the API gives _links.delete to them only).
// System categories (with a code) are read-only and not listed as rows.
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import type { CategoryNode } from '~/utils/categories'

type Tab = 'categories' | 'envelopes'

const route = useRoute()
const router = useRouter()
const tab = computed<Tab>({
  get: () => (route.query.tab === 'envelopes' ? 'envelopes' : 'categories'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'envelopes' ? 'envelopes' : undefined } }),
})
const tabs: Tab[] = ['categories', 'envelopes']

const { data: tree, isPending, isError, refetch } = useCategoriesQuery()
const isCustom = (node: CategoryNode) => node.code === null

const categoryRoots = computed(() => (tree.value?.roots ?? []).filter((r) => r.type !== 'saving'))
const hasCustomCategories = computed(() => categoryRoots.value.some((r) => r.children.some(isCustom)))
const savingRoot = computed(() => tree.value?.roots.find((r) => r.type === 'saving'))
const envelopes = computed(() => (savingRoot.value?.children ?? []).filter(isCustom))

// Category sheet
const categorySheet = reactive({ open: false, iri: null as string | null, parentIri: null as string | null })
function createCategory(root: CategoryNode) {
  Object.assign(categorySheet, { open: true, iri: null, parentIri: root.iri })
}
function editCategory(node: CategoryNode) {
  Object.assign(categorySheet, { open: true, iri: node.iri, parentIri: node.parentIri })
}

// Envelope sheet
const envelopeSheet = reactive({ open: false, iri: null as string | null })
function openEnvelope(iri: string | null) {
  Object.assign(envelopeSheet, { open: true, iri })
}

// Deletion
const remove = useDeleteCategory()
const toDelete = ref<CategoryNode | null>(null)
const deleteOpen = ref(false)
function askDelete(node: CategoryNode) {
  remove.reset()
  toDelete.value = node
  deleteOpen.value = true
}
async function confirmDelete() {
  if (!toDelete.value) return
  try {
    await remove.mutateAsync(toDelete.value.iri)
    deleteOpen.value = false
  } catch {
    // Shown in the dialog
  }
}
const deletingEnvelope = computed(() => toDelete.value?.type === 'saving')
</script>

<template>
  <main class="flex flex-col gap-5 px-4 pt-6 pb-10">
    <PageHeader :title="$t('categorySettings.title')" back="/profile" />

    <div class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
      <button
        v-for="item in tabs"
        :key="item"
        type="button"
        role="tab"
        :aria-selected="tab === item"
        class="min-h-11 rounded-lg text-[15px] font-medium text-slate-600 aria-selected:bg-white aria-selected:font-semibold aria-selected:text-slate-900 aria-selected:shadow-sm"
        @click="tab = item"
      >
        {{ $t(`categorySettings.tabs.${item}`) }}
      </button>
    </div>

    <p v-if="isPending" class="py-8 text-center text-sm text-slate-500">{{ $t('common.loading') }}</p>
    <div v-else-if="isError" class="flex flex-col items-center gap-3 py-8">
      <p class="text-sm text-slate-600">{{ $t('common.loadInterrupted') }}</p>
      <button type="button" class="min-h-11 rounded-full px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50" @click="refetch()">
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- Categories -->
    <template v-else-if="tab === 'categories'">
      <p class="text-sm text-slate-600">
        {{ hasCustomCategories ? $t('categorySettings.categoriesIntro') : $t('categorySettings.categoriesEmpty') }}
      </p>

      <section v-for="root in categoryRoots" :key="root.iri" class="flex flex-col gap-2" :aria-label="root.label">
        <h2 class="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          <component :is="root.icon" class="size-4" aria-hidden="true" />
          {{ root.label }}
        </h2>
        <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <li v-for="child in root.children.filter(isCustom)" :key="child.iri" class="flex min-h-12 items-center gap-2 pr-2 pl-4">
            <component :is="child.icon" class="size-5 flex-none text-slate-500" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate text-[15px]">{{ child.label }}</span>
            <button
              v-if="child.canEdit"
              type="button"
              class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              :aria-label="$t('categorySettings.editNamed', { name: child.label })"
              @click="editCategory(child)"
            >
              <Pencil class="size-4" />
            </button>
            <button
              v-if="child.canDelete"
              type="button"
              class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              :aria-label="$t('categorySettings.deleteNamed', { name: child.label })"
              @click="askDelete(child)"
            >
              <Trash2 class="size-4" />
            </button>
          </li>
          <li>
            <button
              type="button"
              class="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[15px] font-semibold text-indigo-700 hover:bg-indigo-50"
              @click="createCategory(root)"
            >
              <Plus class="size-4" aria-hidden="true" />
              {{ $t('categorySettings.add') }}
            </button>
          </li>
        </ul>
      </section>
    </template>

    <!-- Envelopes -->
    <template v-else>
      <p class="text-sm text-slate-600">
        {{ envelopes.length ? $t('categorySettings.envelopesIntro') : $t('categorySettings.envelopesEmpty') }}
      </p>

      <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <li v-for="envelope in envelopes" :key="envelope.iri" class="flex min-h-14 items-center gap-2 pr-2 pl-3">
          <span class="flex size-9 flex-none items-center justify-center rounded-xl" :class="envelopeColor(envelope.iri).tile" aria-hidden="true">
            <component :is="envelope.icon" class="size-5" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-[15px]">{{ envelope.label }}</span>
            <span v-if="envelope.targetAmount" class="text-xs text-slate-500 tabular-nums">
              {{ $t('envelope.goal', { amount: formatCents(toCents(envelope.targetAmount)) }) }}
            </span>
          </span>
          <button
            v-if="envelope.canEdit"
            type="button"
            class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            :aria-label="$t('categorySettings.editNamed', { name: envelope.label })"
            @click="openEnvelope(envelope.iri)"
          >
            <Pencil class="size-4" />
          </button>
          <button
            v-if="envelope.canDelete"
            type="button"
            class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            :aria-label="$t('categorySettings.deleteNamed', { name: envelope.label })"
            @click="askDelete(envelope)"
          >
            <Trash2 class="size-4" />
          </button>
        </li>
        <li v-if="savingRoot">
          <button
            type="button"
            class="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[15px] font-semibold text-indigo-700 hover:bg-indigo-50"
            @click="openEnvelope(null)"
          >
            <Plus class="size-4" aria-hidden="true" />
            {{ $t('envelope.new') }}
          </button>
        </li>
      </ul>
    </template>

    <CategorySheet
      :iri="categorySheet.iri"
      :parent-iri="categorySheet.parentIri"
      :open="categorySheet.open"
      @close="categorySheet.open = false"
    />
    <EnvelopeSheet :iri="envelopeSheet.iri" :open="envelopeSheet.open" @close="envelopeSheet.open = false" />

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="
        deletingEnvelope
          ? $t('categorySettings.deleteEnvelopeTitle', { name: toDelete?.label ?? '' })
          : $t('categorySettings.deleteCategoryTitle', { name: toDelete?.label ?? '' })
      "
      :confirm-label="$t('common.delete')"
      tone="danger"
      :icon="Trash2"
      :pending="remove.isPending.value"
      :error="remove.isError.value ? $t('errors.deleteFailedRetry') : null"
      @confirm="confirmDelete"
    >
      <p>{{ deletingEnvelope ? $t('categorySettings.deleteEnvelopeText') : $t('categorySettings.deleteCategoryText') }}</p>
    </ConfirmDialog>
  </main>
</template>
