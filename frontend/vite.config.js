import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The backend serves the build under /app/; in dev, API calls proxy to the Go server.
export default defineConfig({
  base: '/app/',
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
})
