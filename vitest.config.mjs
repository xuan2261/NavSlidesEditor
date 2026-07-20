import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const configRoot = path.dirname(fileURLToPath(import.meta.url))
const productionDataDir = path.join(configRoot, 'server', 'data')
const productionUploadsDir = path.join(configRoot, 'server', 'uploads')

function isWithinOrEqual(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

const configuredTempDir = path.resolve(tmpdir())
const invocationBase = [productionDataDir, productionUploadsDir].some((productionDir) =>
  isWithinOrEqual(productionDir, configuredTempDir)
)
  ? path.resolve(configRoot, '..')
  : configuredTempDir
const invocationRoot = path.join(invocationBase, `navslides-vitest-${process.pid}-${randomUUID()}`)
const callerDataDir = process.env.SLIDES_DATA_DIR
const callerUploadsDir = process.env.SLIDES_UPLOADS_DIR
const dataDir = callerDataDir || path.join(invocationRoot, 'data')
const uploadsDir = callerUploadsDir || path.join(invocationRoot, 'uploads')

if (!callerDataDir || !callerUploadsDir) {
  process.once('exit', () => {
    try {
      rmSync(invocationRoot, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 })
    } catch (error) {
      process.stderr.write(`[vitest] Failed to remove isolated storage: ${error.message}\n`)
    }
  })
}

export default defineConfig({
  test: {
    env: {
      SLIDES_DATA_DIR: dataDir,
      SLIDES_UPLOADS_DIR: uploadsDir,
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-electron/**', '**/.claude/worktrees/**', 'tests/e2e/**'],
    fileParallelism: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.join(configRoot, 'vitest-setup-jsdom-pointer-event-polyfills-for-radix-ui.js')],
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
