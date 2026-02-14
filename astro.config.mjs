// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    imageService: true,
    imagesConfig: {
      sizes: [320, 640, 768, 1024, 1280, 1536, 1920],
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 2592000,
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '^nyzseanzxktydxusgwhy\\.supabase\\.co$',
          pathname: '^/storage/v1/object/public/.*$',
        },
        {
          protocol: 'https',
          hostname: '^images\\.unsplash\\.com$',
        },
      ],
    },
  }),

  image: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
    layout: 'constrained',
    breakpoints: [320, 640, 768, 1024, 1280, 1536],
  },

  devToolbar: {
    enabled: false,
  },

  integrations: [react()],

  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // React core + @react-three bindings in ONE chunk.
            // @react-three imports both react and three, so isolating
            // it into vendor-three creates a circular dep:
            //   vendor-three ↔ vendor-react
            // Merging @react-three with react keeps the dependency
            // one-way: vendor-react → vendor-three (no cycle).
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('@react-three')
            ) {
              return 'vendor-react';
            }
            // Three.js core — no React dependencies
            if (id.includes('node_modules/three/')) {
              return 'vendor-three';
            }
            // GSAP — shared chunk, used by many pages
            if (id.includes('gsap')) {
              return 'vendor-gsap';
            }
            // Admin packages — routing, state management, notifications, drag-and-drop
            if (
              id.includes('react-router-dom') ||
              id.includes('@tanstack/react-query') ||
              id.includes('react-hot-toast') ||
              id.includes('@dnd-kit')
            ) {
              return 'vendor-admin';
            }
            // Supabase — database and auth
            if (
              id.includes('@supabase/supabase-js') ||
              id.includes('@supabase/ssr')
            ) {
              return 'vendor-supabase';
            }
            // Editor — markdown editor
            if (id.includes('@uiw/react-md-editor')) {
              return 'vendor-editor';
            }
          },
        },
      },
    },
  },
});