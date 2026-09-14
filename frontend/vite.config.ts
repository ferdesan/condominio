import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Evita CORS no desenvolvimento: o front chama /api e o Vite repassa a API.
      '/api': { target: 'http://localhost:3333', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3333', ws: true, changeOrigin: true },
    },
  },
  preview: { port: 4173, host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Vendors pesados em chunks proprios: melhora o cache entre deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          query: ['@tanstack/react-query', 'axios'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      // `json` nao e redundante com os outros: e o unico que escreve
      // `coverage-final.json`, que e justamente o arquivo que o passo de upload
      // do pipeline aponta (`.github/workflows/ci-cd.yml`). Sem ele o comando de
      // cobertura roda verde e o upload nao encontra nada (US-028.EC-3).
      reporter: ['text', 'lcov', 'html', 'json'],
      // O harness de teste e os pontos de entrada nao sao codigo sob teste.
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/components/ui/**-variants.ts',
      ],
    },
  },
});
