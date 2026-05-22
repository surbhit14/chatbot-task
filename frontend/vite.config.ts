import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // More specific paths must come before the catch-all
      '/api/ingest': {
        target: 'http://ingestion:3001',
        changeOrigin: true,
      },
      '/api/metrics': {
        target: 'http://ingestion:3001',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true,
      },
    },
  },
});
