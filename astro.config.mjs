import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import keystatic from '@keystatic/astro';

export default defineConfig({
  site: process.env.SITE_URL || 'https://gdev-portfolio.vercel.app',
  output: 'static',
  integrations: [
    mdx(),
    react(),
    keystatic(),
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/keystatic'),
    }),
  ],
  adapter: vercel(),
});
