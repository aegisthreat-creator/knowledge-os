import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: true, // enables Testing Library's automatic DOM cleanup
    include: ['src/**/*.test.{ts,tsx}'],
    // Component tests opt into jsdom via a `@vitest-environment jsdom` docblock.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
