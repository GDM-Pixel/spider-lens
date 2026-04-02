import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    manifest: true,
    rollupOptions: {
      input: 'src/main.jsx',
    },
  },
  // En dev, on proxie les requêtes REST WP vers un WP local
  server: {
    proxy: {
      '/wp-json': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
