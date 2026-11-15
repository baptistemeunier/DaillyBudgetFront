// Gives utils/i18n.ts the global i18n instance and keeps <html lang> on the current locale.
import type { Composer } from 'vue-i18n'

export default defineNuxtPlugin({
  name: 'i18n-bridge',
  dependsOn: ['i18n:plugin'],
  setup(nuxtApp) {
    const i18n = nuxtApp.$i18n as unknown as Composer
    bindI18n(i18n)
    watch(
      i18n.locale,
      (locale) => {
        document.documentElement.lang = locale
      },
      { immediate: true },
    )
  },
})
