import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = Number(process.env.API_PORT ?? 3001);

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { '/api': `http://localhost:${API_PORT}` },
  },
  build: { outDir: '../dist', emptyOutDir: true },
});
