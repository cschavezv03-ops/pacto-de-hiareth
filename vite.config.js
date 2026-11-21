import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1600, // Phaser ocupa ~1.2 MB minificado
  },
});
