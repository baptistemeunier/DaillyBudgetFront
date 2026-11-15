<script setup lang="ts">
const { data: actions } = useUserActionsQuery()

const track = ref<HTMLElement | null>(null)
const active = ref(0)

// Width of one card + gap, read from the DOM so it follows the responsive layout.
function step(): number {
  const el = track.value
  const [first, second] = el ? Array.from(el.children as HTMLCollectionOf<HTMLElement>) : []
  if (!first) return 1
  return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
}

function onScroll() {
  if (!track.value || !actions.value) return
  active.value = Math.min(actions.value.length - 1, Math.max(0, Math.round(track.value.scrollLeft / step())))
}

function goTo(index: number) {
  track.value?.scrollTo({ left: index * step(), behavior: 'smooth' })
}

// The list can shrink (action done): keep the active dot in range.
watch(
  () => actions.value?.length ?? 0,
  (n) => {
    if (active.value >= n) active.value = Math.max(0, n - 1)
  },
)
</script>

<template>
  <section v-if="actions?.length" class="flex flex-col gap-3" aria-labelledby="todo-title">
    <h2 id="todo-title" class="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
      {{ $t('todo.title') }}
      <span class="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] text-white tabular-nums">{{ actions.length }}</span>
    </h2>

    <div
      ref="track"
      class="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      @scroll.passive="onScroll"
    >
      <div
        v-for="(action, index) in actions"
        :key="action.id"
        class="flex-none snap-start"
        :class="actions.length > 1 ? 'w-[85%]' : 'w-full'"
        role="group"
        :aria-roledescription="$t('todo.card')"
        :aria-label="$t('todo.position', { index: index + 1, total: actions.length })"
      >
        <TodoCard :action="action" />
      </div>
    </div>

    <div v-if="actions.length > 1" class="flex justify-center gap-1.5">
      <button
        v-for="(action, index) in actions"
        :key="action.id"
        type="button"
        class="flex h-4 items-center"
        :aria-label="$t('todo.dot', { n: index + 1 })"
        :aria-current="index === active ? 'true' : undefined"
        @click="goTo(index)"
      >
        <span
          class="block h-1.5 rounded-full transition-all"
          :class="index === active ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300'"
        />
      </button>
    </div>
  </section>
</template>
