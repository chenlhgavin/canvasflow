// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://chenlhgavin.github.io',
  base: '/canvasflow',
  server: {
    host: '0.0.0.0',
    port: 4322,
  },
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), mdx()],
});
