import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { execSync } from 'child_process'

const commitSha = (() => {
  if (process.env.VITE_COMMIT_SHA) return process.env.VITE_COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

export default defineConfig({
  plugins: [
    {
      name: 'local-preview',
      configureServer(server) {
        if (process.env.FOCUS_LOCAL_PREVIEW !== '1') return
        // boffin: only the dev server maps preview documents; deployed entries keep Clerk authentication.
        server.middlewares.use((request, _response, next) => {
          const path = request.url?.split('?')[0]
          if (path === '/') request.url = '/tests/todo.html'
          else if (path && /^\/(?:finance|money)(?:\.html)?\/?$/.test(path)) request.url = '/tests/vault.html'
          else if (path && /^\/weight(?:\.html)?\/?$/.test(path)) request.url = '/tests/weight.html'
          next()
        })
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Always re-fetch the app shell from the network so deploys ship.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/sso-callback/, /^\/(finance|money|weight)(\/|\.|$)/i],
        runtimeCaching: [
          {
            urlPattern: /^\/$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: {
        name: 'Focus',
        short_name: 'Focus',
        description: 'A focused task board',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  root: '.',
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(commitSha),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: { focus: resolve(__dirname, 'index.html'), finance: resolve(__dirname, 'finance.html'), weight: resolve(__dirname, 'weight.html') },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
})
