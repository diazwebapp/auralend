import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

export default defineConfig({
  output:"server",

  server:{
    host:'0.0.0.0'
  },

  adapter: vercel()
});