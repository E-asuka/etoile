// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // Long Japanese Firefly filenames can throw EBUSY on Windows watchers
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

  adapter: node({
    mode: 'standalone',
  }),
});
