import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()], output: 'static',
  vite: {
    server: {
      port: 4321, strictPort: true,
      proxy: { '/api': { target: 'http://127.0.0.1:8000', rewrite: path => path.replace(/^\/api/, ''), timeout: 360000, proxyTimeout: 360000 } },
    },
  },
});
