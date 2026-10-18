import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = {
  '@shared': resolve(import.meta.dirname, 'src/shared'),
  '@renderer': resolve(import.meta.dirname, 'src/renderer'),
};

export default defineConfig({
  test: {
    reporters: ['default', ['junit', { outputFile: 'test-results/vitest-junit.xml' }]],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main/index.ts', 'src/renderer/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/{main,preload,shared}/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['tests/unit/renderer/**/*.test.tsx'],
          setupFiles: ['tests/setup/renderer.ts'],
          css: { modules: { classNameStrategy: 'non-scoped' } },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
    ],
  },
});
