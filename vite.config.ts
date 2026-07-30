import path from 'path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./test/setup.ts'],
        env: {
          VITE_APPWRITE_ENDPOINT: 'https://test.appwrite.local/v1',
          VITE_APPWRITE_PROJECT_ID: 'test-project',
          VITE_APPWRITE_DATABASE_ID: 'test-db',
          VITE_APPWRITE_PROJECTS_COLLECTION_ID: 'test-projects',
        },
        exclude: ['node_modules/**', 'dist/**'],
      }
    };
});
