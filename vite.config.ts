import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Capacitor lädt `dist` aus dem App-Bundle; relative Pfade vermeiden kaputte Assets.
  base: command === 'serve' ? '/' : './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: {
      ignored: ['**/server/data/**', '**/server/*.js', '**/.env*'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4242',
        changeOrigin: true,
      },
    },
  },
}));
