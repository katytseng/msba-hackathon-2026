import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site at /<repo-name>/.
// The deploy workflow sets VITE_BASE to "/<repo-name>/" automatically,
// so nobody has to hard-code the repo name. Locally it falls back to "./".
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1000 },
})
