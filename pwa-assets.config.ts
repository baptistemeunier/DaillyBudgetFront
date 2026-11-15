// PWA icons generated at build time from public/logo.svg (@vite-pwa/nuxt, pwaAssets).
// The logo already has a full-bleed indigo background with the gauge inside the maskable safe
// zone, so no padding is added. Favicons are hand-made (public/favicon.svg / .ico), not generated.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const background = { background: '#4f46e5' }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0, favicons: [] },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: background },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: background },
  },
  images: ['public/logo.svg'],
})
