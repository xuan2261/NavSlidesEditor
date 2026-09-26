import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import clientConfig from '../../config/vitest/client-jsdom.config.mjs'
import parallelConfig from '../../config/vitest/node-parallel.config.mjs'
import serialConfig from '../../config/vitest/node-serial.config.mjs'
import {
  VITEST_PROJECT_NAMES,
  buildVitestTopology,
  discoverVitestFiles,
  repoRoot,
} from '../../config/vitest/vitest-lanes.mjs'
import {
  captureFacts,
  captureSourceFingerprint,
  captureTestInventory,
  hashFile,
} from './baseline-support.mjs'
import { buildInventoryReceipt, validateLaneUnion } from './inventory-validation.mjs'

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    out: { type: 'string' },
  },
})

function writeReceipt(outputPath, receipt) {
  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`)
}

function captureLegacy() {
  if (!values.config || !values.out) {
    throw new Error('Legacy capture requires --config <file> --out <file>')
  }
  const configPath = path.resolve(repoRoot, values.config)
  const sourceConfigPath = path.join(repoRoot, 'vitest.config.mjs')
  const before = captureSourceFingerprint()
  const inventory = captureTestInventory()
  const sourceStable = before.hash === captureSourceFingerprint().hash
  const receipt = {
    schemaVersion: 1,
    kind: 'vitest-legacy-inventory',
    ...captureFacts(),
    config: {
      path: path.relative(repoRoot, configPath).replaceAll('\\', '/'),
      sha256: hashFile(configPath),
      sourcePath: 'vitest.config.mjs',
      sourceSha256: hashFile(sourceConfigPath),
      relocationDifference:
        "configRoot resolves '../..' because the immutable snapshot moved under config/vitest",
      topology: {
        projects: null,
        environment: 'jsdom',
        fileParallelism: false,
        thresholds: { lines: 74, branches: 60, functions: 68, statements: 71 },
      },
    },
    discovery: {
      pattern: '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      excluded: [
        '**/node_modules/**',
        '**/dist/**',
        '**/dist-electron/**',
        '**/.claude/worktrees/**',
        'tests/e2e/**',
      ],
    },
    sourceFingerprint: before,
    sourceStableDuringCapture: sourceStable,
    inventory,
  }
  writeReceipt(path.resolve(repoRoot, values.out), receipt)
  console.log(`[vitest-inventory] ${inventory.fileCount} files`)
  console.log(`[vitest-inventory] inventory sha256 ${inventory.hash}`)
  if (!sourceStable) process.exitCode = 2
}

function projectTest(config) {
  return config.test ?? config
}

function captureCanonical() {
  const topology = buildVitestTopology({ files: discoverVitestFiles() })
  const configs = [clientConfig, parallelConfig, serialConfig]
  const lanePaths = Object.fromEntries(
    configs.map((config) => {
      const test = projectTest(config)
      return [test.name, test.include]
    })
  )
  const validation = validateLaneUnion(topology.files, lanePaths)
  const outputPath = path.resolve(repoRoot, values.out || '.tmp/vitest-inventory.json')
  const receipt = buildInventoryReceipt(topology.files, validation, {
    config: {
      path: 'vitest.config.mjs',
      sha256: hashFile(path.join(repoRoot, 'vitest.config.mjs')),
      projects: VITEST_PROJECT_NAMES,
    },
    laneCounts: Object.fromEntries(
      VITEST_PROJECT_NAMES.map((lane) => [lane, lanePaths[lane]?.length || 0])
    ),
  })
  writeReceipt(outputPath, receipt)
  console.log(`[vitest-inventory] ${receipt.inventory.fileCount} files`)
  console.log(`[vitest-inventory] inventory sha256 ${receipt.inventory.hash}`)
  console.log(`[vitest-inventory] exact lane union ${validation.valid}`)
  if (!validation.valid) {
    console.error(JSON.stringify(validation, null, 2))
    process.exitCode = 2
  }
}

if (values.config || (values.out && values.config)) captureLegacy()
else captureCanonical()
