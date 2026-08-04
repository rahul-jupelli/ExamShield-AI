import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: {
        port: 24679,
      },
      proxy: {
        '/api': 'http://localhost:5000',
        '/ws': {
          target: 'ws://localhost:5000',
          ws: true,
        },
      },
    },
  };
});
