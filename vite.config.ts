import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
  server: {
    port: 5173,
    host: true,
    // Allow access via public tunnels (e.g., *.loca.lt / trycloudflare)
    allowedHosts: true,
    hmr: { overlay: true },
    // Improve stability on Windows/WSL/Network drives
    watch: { usePolling: false, interval: 150 },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy static uploads to avoid mixed content when app is opened via HTTPS tunnel
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: { port: 4173, host: true, allowedHosts: true },
})
