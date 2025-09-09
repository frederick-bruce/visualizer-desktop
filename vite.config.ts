import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
// Ensure Tailwind v4 PostCSS runs even if external config resolution fails
import tailwind from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

export default defineConfig(() => {
  // prefer explicit env port (e.g. PORT or VITE_DEV_PORT), fall back to 5173
  const envPort = process.env.PORT || process.env.VITE_DEV_PORT || process.env.VITE_PORT
  const port = envPort ? Number(envPort) : 5173

  return {
    plugins: [react()],
    // don't fail hard if port is already in use; let vite pick the next free port
    server: { port, strictPort: false },
    css: {
      postcss: {
        // Explicitly provide PostCSS plugins so Tailwind v4 always processes index.css
        plugins: [tailwind(), autoprefixer()],
      },
    },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    },
  }
})
