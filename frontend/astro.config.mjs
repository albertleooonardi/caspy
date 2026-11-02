import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const task = process.argv.find(arg => ['dev', 'build', 'check', 'preview', 'sync'].includes(arg)) || 'dev';

export default defineConfig({
  integrations: [react()], output: 'static',
  vite: {
    // Builds and Astro checks must not replace an active dev server's modules.
    cacheDir: `node_modules/.vite-${task}`,
    optimizeDeps: {
      include: ['react', 'react-dom/client', 'lucide-react', 'viem', 'viem/chains', 'viem/siwe'],
    },
    server: {
      port: 4321, strictPort: true,
      proxy: { '/api': { target: 'http://127.0.0.1:8000', rewrite: path => path.replace(/^\/api/, ''), timeout: 360000, proxyTimeout: 360000 } },
    },
  },
});
