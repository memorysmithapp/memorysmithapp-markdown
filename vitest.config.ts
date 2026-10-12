// One Vitest configuration for the workspace: each package is a project, and the renderer's
// tests run in jsdom. `pnpm test` at the root runs every project.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'markdown-spec',
          root: 'packages/markdown-spec',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'markdown-renderer',
          root: 'packages/markdown-renderer',
          include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
