import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Lets HTTPS tunnels (cloudflared quick tunnels) reach the dev server for phone testing.
    allowedHosts: ['.trycloudflare.com'],
    port: 5174,
    proxy: {
      // xfwd passes the visitor's IP on, so the API can rate-limit per person.
      '/api': { target: 'http://localhost:3000', xfwd: true },
    },
  },
})
