import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 43921,
    proxy: {
      '/api': {
        target: 'http://localhost:34823',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
