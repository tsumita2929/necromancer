/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const contract = fileURLToPath(new URL('../../packages/engine/src/types.ts', import.meta.url));

// The base path comes from VITE_BASE so the same build can live at "/" or at a
// sub-path such as "/necromancer/" on GitHub Pages.
function normaliseBase(value: string | undefined): string {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig({
  base: normaliseBase(process.env.VITE_BASE),
  plugins: [react()],
  resolve: { alias: { '@contract': contract } },
  build: { target: 'es2022', sourcemap: false },
  // The engine lives next to the app (file: dependency), and tests read its recorded answers.
  server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
  },
});
