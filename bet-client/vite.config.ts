import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Statik site: backend/proxy yok. Veri public/data/*.json'dan okunur.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
  },
});
