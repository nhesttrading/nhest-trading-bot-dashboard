import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Cast process to any to avoid TS error about missing cwd() method
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    root: '.', // Set the project root to the current directory
    publicDir: 'public', // Serve static files from the public folder
    plugins: [react()],
    // define: process.env.API_KEY removed in favor of import.meta.env.VITE_GEMINI_API_KEY
    resolve: {
      alias: {
        '@': path.resolve((process as any).cwd(), '.'),
      },
    },
    server: {
      proxy: {
        '/socket.io': {
          target: 'http://127.0.0.1:8000',
          ws: true,
          changeOrigin: true
        },
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist', // Output build to a dist folder
      emptyOutDir: true,
    }
  };
});