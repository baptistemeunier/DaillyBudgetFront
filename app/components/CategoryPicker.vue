<script setup lang="ts">
// Searchable category tree, drill-down: tapping a parent opens its sub-categories.
// Only sub-categories can be picked (the API refuses a root on a split): a parent always opens,
// even empty, so a sub-category can be created there.
// A single offered parent (Épargne on a savings account) is shown opened, without the way back.
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from 'lucide-vue-next'
import type { CategoryType, EnvelopeInput } from '~/types/api'
import type { CategoryNode, CategoryTree } from '~/utils/categories'

const props = defineProps<{
  tree: CategoryTree
  /** Only these category types are offered (credit vs debit). All when omitted. */
  types?: CategoryType[]
  /** Currently selected IRIs (checked). */
  selected?: string[]
  /** IRIs that cannot be picked (already used in another split line). */
  disabled?: string[]
  busy?: boolean
}>()
const emit = defineEmits<{ pick: [iri: string] }>()

const isVisible = (node: CategoryNode) => !props.types || props.types.includes(node.type)
const isPickable = (node: CategoryNode) => !!node.parentIri
const visibleRoots = computed(() => props.tree.roots.filter(isVisible))

const onlyRoot = computed(() => (visibleRoots.value.length === 1 ? visibleRoots.value[0]! : null))

const search = ref('')
const openRootIri = ref<string | null>(onlyRoot.value?.iri ?? null)
const openRoot = computed(() => (openRootIri.value ? props.tree.byIri.get(openRootIri.value) : undefined))

// Start inside the parent of the current selection (if that parent is offered here).
const firstSelected = props.selected?.[0] ? props.tree.byIri.get(props.selected[0]) : undefined
const selectedParent = firstSelected?.parentIri ? props.tree.byIri.get(firstSelected.parentIri) : undefined
if (selectedParent && isVisible(selectedParent)) openRootIri.value = selectedParent.iri

const results = computed(() => {
  const q = normalizeSearch(search.value)
  if (!q) return null
  return [...props.tree.byIri.values()]
    .filter((n) => isVisible(n) && isPickable(n) && normalizeSearch(n.fullLabel).includes(q))
    .sort((a, b) => a.fullLabel.localeCompare(b.fullLabel, 'fr'))
})

const isSelected = (iri: string) => props.selected?.includes(iri) ?? false
const isDisabled = (iri: string) => props.busy || ((props.disabled?.includes(iri) ?? false) && !isSelected(iri))
/** A child of this root is selected. */
const hasSelectedChild = (root: CategoryNode) => root.children.some((c) => isSelected(c.iri))

function onRoot(root: CategoryNode) {
  openRootIri.value = root.iri
}

// Shortcut: create a sub-category of the opened parent, then pick it.
const create = useCreateCategory()
const creating = ref(false)
const newName = ref('')
const newIcon = ref('tag')
const iconGridOpen = ref(false)
const iconGridId = useId()
const createError = ref<string | null>(null)
const newNameInput = ref<HTMLInputElement | null>(null)

function startCreate() {
  creating.value = true
  newName.value = search.value
  newIcon.value = openRoot.value?.iconName ?? 'tag'
  iconGridOpen.value = false
  createError.value = null
  nextTick(() => newNameInput.value?.focus())
}

watch(openRootIri, () => {
  creating.value = false
  createError.value = null
})

// Under Épargne the sub-category is an envelope: name + target.
async function submitEnvelope(input: EnvelopeInput) {
  if (!openRoot.value || create.isPending.value) return
  createError.value = null
  try {
    const category = await create.mutateAsync({ ...input, parent: openRoot.value.iri })
    creating.value = false
    emit('pick', category._links.self.href)
  } catch (e) {
    createError.value =
      apiErrorStatus(e) === 403 ? 'Vous n’avez pas le droit de créer des catégories.' : apiErrorMessage(e, 'La création a échoué.')
  }
}

async function submitCreate() {
  const name = newName.value.trim()
  if (!name || !openRoot.value || create.isPending.value) return
  createError.value = null
  try {
    const category = await create.mutateAsync({ name, icon: newIcon.value, parent: openRoot.value.iri })
    creating.value = false
    newName.value = ''
    emit('pick', category._links.self.href)
  } catch (e) {
    const err = e as { status?: number; data?: { violations?: { message: string }[]; detail?: string } }
    createError.value =
      err.status === 403
        ? 'Vous n’avez pas le droit de créer des catégories.'
        : err.data?.violations?.map((v) => v.message).join(' ') || err.data?.detail || 'La création a échoué.'
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="relative block">
      <span class="sr-only">Rechercher une catégorie</span>
      <Search class="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
      <input
        v-model="search"
        type="search"
        placeholder="Rechercher une catégorie"
        autocomplete="off"
        class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-11 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </label>

    <!-- Search results: flat list -->
    <ul v-if="results" class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
      <li v-if="!results.length" class="px-4 py-4 text-sm text-slate-500">Aucune catégorie ne correspond.</li>
      <li v-for="node in results" :key="node.iri">
        <button
          type="button"
          class="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-slate-50 disabled:opacity-40"
          :disabled="isDisabled(node.iri)"
          @click="emit('pick', node.iri)"
        >
          <component :is="node.icon" class="size-5 flex-none text-slate-600" aria-hidden="true" />
          <span class="flex-1 text-[15px]">{{ node.fullLabel }}</span>
          <Check v-if="isSelected(node.iri)" class="size-5 text-indigo-600" aria-label="Sélectionnée" />
        </button>
      </li>
    </ul>

    <!-- Sub-categories of the opened parent -->
    <div v-else-if="openRoot" class="flex flex-col gap-2">
      <button
        v-if="!onlyRoot"
        type="button"
        class="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-full pr-3 pl-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        @click="openRootIri = null"
      >
        <ChevronLeft class="size-5" aria-hidden="true" /> Toutes les catégories
      </button>

      <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        <li class="flex min-h-14 items-center gap-3 bg-slate-50 px-4">
          <span class="flex size-9 flex-none items-center justify-center rounded-full bg-white" aria-hidden="true">
            <component :is="openRoot.icon" class="size-5 text-slate-700" />
          </span>
          <span class="text-[15px] font-semibold">{{ openRoot.label }}</span>
        </li>
        <li v-if="!openRoot.children.length" class="py-3 pr-4 pl-16 text-sm text-slate-500">
          Aucune sous-catégorie pour l'instant.
        </li>
        <li v-for="child in openRoot.children" :key="child.iri">
          <button
            type="button"
            class="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-slate-50 disabled:opacity-40"
            :disabled="isDisabled(child.iri)"
            @click="emit('pick', child.iri)"
          >
            <span class="flex size-9 flex-none items-center justify-center" aria-hidden="true">
              <component :is="child.icon" class="size-5 text-slate-500" />
            </span>
            <span class="flex-1 text-[15px]">{{ child.label }}</span>
            <Check v-if="isSelected(child.iri)" class="size-5 text-indigo-600" aria-label="Sélectionnée" />
          </button>
        </li>

        <!-- New sub-category -->
        <li v-if="!creating">
          <button
            type="button"
            class="flex min-h-12 w-full items-center gap-2 pr-4 pl-16 text-left text-[15px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
            :disabled="busy"
            @click="startCreate"
          >
            <Plus class="size-4" aria-hidden="true" />
            {{ openRoot.type === 'saving' ? 'Nouvelle enveloppe' : 'Nouvelle sous-catégorie' }}
          </button>
        </li>
        <li v-else-if="openRoot.type === 'saving'" class="p-3">
          <EnvelopeForm
            compact
            :initial="{ name: search }"
            submit-label="Créer"
            :pending="create.isPending.value"
            :error="createError"
            @submit="submitEnvelope"
            @cancel="creating = false"
          />
        </li>
        <li v-else class="flex flex-col gap-2 py-2.5 pr-3 pl-4">
          <form class="flex items-center gap-2" @submit.prevent="submitCreate">
            <IconPicker v-model="newIcon" v-model:open="iconGridOpen" :controls="iconGridId" />
            <label class="min-w-0 flex-1">
              <span class="sr-only">Nom de la sous-catégorie</span>
              <input
                ref="newNameInput"
                v-model="newName"
                maxlength="100"
                placeholder="Nom"
                autocomplete="off"
                class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                @keydown.esc.stop.prevent="creating = false"
              />
            </label>
            <button
              type="submit"
              class="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
              :disabled="!newName.trim() || create.isPending.value || busy"
            >
              <Loader2 v-if="create.isPending.value" class="size-4 animate-spin" aria-hidden="true" />
              Créer
            </button>
            <button
              type="button"
              class="flex size-11 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Annuler"
              @click="creating = false"
            >
              <X class="size-5" />
            </button>
          </form>
          <IconGrid v-if="iconGridOpen" :id="iconGridId" v-model="newIcon" @picked="iconGridOpen = false" />
          <p v-if="createError" class="text-xs text-rose-700" role="alert">{{ createError }}</p>
        </li>
      </ul>
    </div>

    <!-- Parents -->
    <ul v-else class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
      <li v-for="root in visibleRoots" :key="root.iri">
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-slate-50 disabled:opacity-40"
          @click="onRoot(root)"
        >
          <span class="flex size-9 flex-none items-center justify-center rounded-full bg-slate-100" aria-hidden="true">
            <component :is="root.icon" class="size-5 text-slate-700" />
          </span>
          <span class="flex-1 text-[15px] font-medium">{{ root.label }}</span>
          <Check
            v-if="isSelected(root.iri) || hasSelectedChild(root)"
            class="size-5 text-indigo-600"
            aria-label="Sélectionnée"
          />
          <ChevronRight class="size-4 flex-none text-slate-400" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
