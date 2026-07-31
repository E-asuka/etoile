// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// Static portfolio site for Cloudflare Pages (reservation UI is client-side mock)
export default defineConfig({
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/Firefly_*', '**/src/assets/**/*.png.tmp'],
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
  },

  integrations: [react()],
});
