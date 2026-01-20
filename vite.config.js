import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        note: resolve(__dirname, 'note.html'),
        login: resolve(__dirname, 'login.html'),
        stats: resolve(__dirname, 'stats.html'),
        profile: resolve(__dirname, 'profile.html'),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'BrainLog',
        short_name: 'BrainLog',
        description: 'My Second Brain',
        theme_color: '#0d0d0d',
        icons: [
          {
            src: 'pwa-192x192.png', // You need to add these images to /public folder later
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})