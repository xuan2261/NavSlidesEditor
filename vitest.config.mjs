import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-electron/**', 'tests/e2e/**'],
    fileParallelism: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest-setup-jsdom-pointer-event-polyfills-for-radix-ui.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      // Anti-regression thresholds based on 2026-05-19 baseline (Phase 9).
      // Set ~3 pts below measured coverage (lines:37.7, branches:31.6,
      // functions:30.3, statements:36.2) to absorb noise from removed/added
      // tests in unrelated PRs while still preventing real regression. Bump
      // these via dedicated PRs as coverage rises toward the 80% goal.
      thresholds: {
        lines: 33,
        branches: 28,
        functions: 26,
        statements: 33,
      },
      include: [
        'client/src/**/*.{js,jsx}',
        'server/**/*.js',
        'shared/src/**/*.js',
      ],
      exclude: [
        '**/*.test.{js,jsx}',
        '**/__tests__/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/dist-electron/**',
        'tests/**',
        'client/src/main.jsx',
        'client/public/**',
        'electron/**',
        'server/vendor/**',
        'server/uploads/**',
        'server/data/**',
        'server/scripts/**',
        'server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js',
      ],
    },
  },
})
