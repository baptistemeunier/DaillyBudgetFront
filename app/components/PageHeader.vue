<script setup lang="ts">
// Page header: optional back button, centered title, optional trailing action.
import { ArrowLeft } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ title?: string; back?: string | false }>(), {
  title: undefined,
  back: false,
})

const router = useRouter()
function goBack() {
  if (window.history.state?.back) router.back()
  else if (props.back) router.push(props.back)
}
</script>

<template>
  <header class="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
    <div class="flex">
      <slot name="leading">
        <button
          v-if="back"
          type="button"
          class="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-slate-100"
          aria-label="Retour"
          @click="goBack"
        >
          <ArrowLeft class="size-5" />
        </button>
      </slot>
    </div>
    <h1 class="truncate text-center text-xl font-bold">
      <slot>{{ title }}</slot>
    </h1>
    <div class="flex justify-end">
      <slot name="trailing" />
    </div>
  </header>
</template>
