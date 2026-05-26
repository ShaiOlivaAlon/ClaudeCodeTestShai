import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Repo name controls the path GitHub Pages serves from
// (https://<user>.github.io/<repo>/). Override locally with VITE_BASE if needed.
const REPO = 'ClaudeCodeTestShai';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}));
