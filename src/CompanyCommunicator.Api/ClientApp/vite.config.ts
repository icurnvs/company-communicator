import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  const apiUrl = env.VITE_API_URL || 'https://localhost:5001';

  return {
    plugins: [react()],
    base: '/clientapp/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            fluent: ['@fluentui/react-components'],
            query: ['@tanstack/react-query'],
            router: ['react-router-dom'],
            form: ['react-hook-form', 'zod', '@hookform/resolvers'],
            teams: ['@microsoft/teams-js'],
            adaptivecards: ['adaptivecards'],
            i18n: ['i18next', 'react-i18next'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
