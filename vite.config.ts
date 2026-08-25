import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative paths so the build works from any subdirectory (GitHub Pages, etc.)
  base: './',
  plugins: [react()],
  define: {
    // Shown in Settings so any device can tell which build it's running.
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
  },
})
