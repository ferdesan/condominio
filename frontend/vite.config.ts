import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    /**
     * PWA **passivo**: o app fica instalavel e roda offline, mas nao há nada
     * procurando `beforeinstallprompt` para exibir um banner. O usuario instala
     * pelo proprio launcher ou pelo "Adicionar a tela de inicio" do navegador, o
     * que ele ja sabia fazer; um banner nosso seria mais um convite para dispensar
     * e mais uma tela para manter.
     *
     * `autoUpdate` e o que torna a atualizacao invisivel: o service worker troca
     * por tras na proxima navegacao, sem prompt nem recarregamento forcado. Em
     * troca, nao ha controle de versao — quem implanta uma mudanca que exige
     * migracao de dado precisa considerar isso (a API e a fonte da verdade, e o
     * app so guarda rascunho local de formulario).
     */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Condominio',
        short_name: 'Condominio',
        description: 'Gestao de condominio: financeiro, ocorrencias, reservas e comunicados.',
        lang: 'pt-BR',
        dir: 'ltr',
        display: 'standalone',
        // A barra de status do Android usa `theme_color` e nao a cor do sistema.
        // A shell do app e a sidebar escura (`--sidebar` do tema dark =
        // `hsl(222 47% 10%)` = #0E1525), entao e essa a cor que combina com o
        // que o usuario ve ao abrir. O `#2563eb` que estava no head antes era
        // azul: nao era a cor de nenhuma tela do sistema.
        theme_color: '#0E1525',
        // Cor da tela de abertura, antes do CSS carregar. Clara de proposito: o
        // app abre no tema claro, e com fundo escuro haveria um flash preto em
        // cima de uma UI branca.
        background_color: '#F8FAFC',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/pwa-192x192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        /**
         * A API nunca entra no cache. `/api` e dado ao vivo — saldo, aviso,
         * chamado aberto — e um service worker servindo uma resposta velha sem
         * sinal para o usuario e pior do que sem offline nenhum. O app tambem
         * guarda rascunho em memoria e no IndexedDB do `idb-keyval`; o que a API
         * responde vem sempre da rede.
         */
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // `enabled: false` por padrao: o `npm run dev` nao deve registrar service
        // worker, senao o cache de teste se instala na maquina de desenvolvimento
        // e passa a servir bundle velho depois de cada HMR.
        enabled: false,
      },
    }),
  ],
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
