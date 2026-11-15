<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-md font-sans">
    <NuxtPwaAssets />
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <BottomNav v-if="route.meta.tabs" />
  </div>
</template>
