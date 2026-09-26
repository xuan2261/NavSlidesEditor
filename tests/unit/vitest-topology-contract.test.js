import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import rootConfig from '../../vitest.config.mjs'
import clientConfig from '../../config/vitest/client-jsdom.config.mjs'
import parallelConfig from '../../config/vitest/node-parallel.config.mjs'
import serialConfig from '../../config/vitest/node-serial.config.mjs'
import {
  BROWSER_ENVIRONMENT_REGISTRY,
  FROZEN_INVENTORY_PATH,
  SERIAL_HAZARD_EXEMPTIONS,
  SERIAL_HAZARD_REGISTRY,
  VITEST_PROJECT_NAMES,
  buildVitestTopology,
  classifyVitestFile,
  discoverVitestFiles,
  normalizeVitestPath,
  scanSerialHazards,
} from '../../config/vitest/vitest-lanes.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const frozen = JSON.parse(readFileSync(path.join(repoRoot, FROZEN_INVENTORY_PATH), 'utf8'))
const frozenPaths = frozen.inventory.files.map((entry) => entry.path)

function projectTest(config) {
  return config.test ?? config
}

describe('Vitest topology contract', () => {
  it('defines exactly the three agreed projects', () => {
    expect(VITEST_PROJECT_NAMES).toEqual(['client-jsdom', 'node-parallel', 'node-serial'])
    expect(rootConfig.test.projects.map((project) => projectTest(project).name)).toEqual(
      VITEST_PROJECT_NAMES,
    )
  })

  it('classifies the frozen 605-file inventory exactly once', () => {
    const topology = buildVitestTopology({ files: frozenPaths })
    expect(frozen.inventory.fileCount).toBe(605)
    expect(topology.files).toHaveLength(605)
    expect(topology.unclassified).toEqual([])
    expect(topology.overlaps).toEqual([])
    expect(new Set(topology.files.map((entry) => entry.path)).size).toBe(605)
    expect(topology.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sourceSha256))).toBe(true)
    expect(topology.files.every((entry) => entry.environment && entry.reason && entry.lane)).toBe(
      true,
    )
  })

  it('normalizes Windows, POSIX, relative, and repository-absolute paths', () => {
    const expected = 'client/src/components/example.test.jsx'
    expect(normalizeVitestPath('.\\client\\src\\components\\example.test.jsx')).toBe(expected)
    expect(normalizeVitestPath('./client/src/components/example.test.jsx')).toBe(expected)
    expect(normalizeVitestPath(path.join(repoRoot, expected))).toBe(expected)
    expect(classifyVitestFile(`client\\src\\components\\example.test.jsx`, '')?.lane).toBe(
      'client-jsdom',
    )
  })

  it('honors environment directives before root defaults', () => {
    const node = classifyVitestFile(
      'client/src/utils/source-only.test.js',
      '// @vitest-environment node\n',
    )
    const jsdom = classifyVitestFile(
      'tests/unit/browser-contract.test.js',
      '/** @vitest-environment jsdom */\n',
    )
    expect(node).toMatchObject({ environment: 'node', lane: 'node-parallel' })
    expect(jsdom).toMatchObject({ environment: 'jsdom', lane: 'client-jsdom' })
  })

  it('routes reviewed shared browser semantics to jsdom without editing their tests', () => {
    for (const file of [
      'shared/src/element-renderers.test.js',
      'shared/tests/element-renderers.test.js',
      'shared/tests/htmlgenerator-golden-baseline.test.js',
      'shared/tests/presentation-start-position.test.js',
    ]) {
      expect(classifyVitestFile(file, '')).toMatchObject({
        environment: 'jsdom',
        lane: 'client-jsdom',
      })
    }
    expect(BROWSER_ENVIRONMENT_REGISTRY).toHaveLength(2)
  })

  it('excludes E2E files and fails closed for unknown roots', () => {
    expect(classifyVitestFile('tests/e2e/editor.spec.js', '')).toMatchObject({
      excluded: true,
    })
    expect(() => classifyVitestFile('plugins/example.test.js', '')).toThrow(/unknown test root/i)
  })

  it('routes reviewed hazards to serial and exposes registry and exemptions', () => {
    const source = "import { spawn } from 'node:child_process'\nspawn('node', [])\n"
    const result = classifyVitestFile('scripts/process-runner.test.js', source)
    expect(result).toMatchObject({
      environment: 'node',
      lane: 'node-serial',
    })
    expect(result.serialReason).toMatch(/child process/i)
    expect(SERIAL_HAZARD_REGISTRY.length).toBeGreaterThan(0)
    expect(SERIAL_HAZARD_EXEMPTIONS).toEqual(expect.any(Object))
    expect(scanSerialHazards('scripts/process-runner.test.js', source)).not.toEqual([])
  })

  it('makes project include arrays equal the canonical discovered inventory', () => {
    const discovered = discoverVitestFiles()
    const topology = buildVitestTopology({ files: discovered })
    const configs = [clientConfig, parallelConfig, serialConfig]
    const included = configs.flatMap((config) => projectTest(config).include)

    expect(included.sort()).toEqual(topology.files.map((entry) => entry.path).sort())
    for (const config of configs) {
      const test = projectTest(config)
      const expected = topology.lanes[test.name].map((entry) => entry.path)
      expect(test.include).toEqual(expected)
    }
  })

  it('uses the required lane environments and bounded worker policies', () => {
    expect(projectTest(clientConfig)).toMatchObject({
      name: 'client-jsdom',
      environment: 'jsdom',
      fileParallelism: true,
    })
    expect(projectTest(parallelConfig)).toMatchObject({
      name: 'node-parallel',
      environment: 'node',
      pool: 'forks',
      fileParallelism: true,
    })
    expect(projectTest(serialConfig)).toMatchObject({
      name: 'node-serial',
      environment: 'node',
      pool: 'forks',
      fileParallelism: false,
      maxWorkers: 1,
      minWorkers: 1,
    })
    expect(projectTest(parallelConfig).maxWorkers).toBeGreaterThanOrEqual(1)
    expect(projectTest(parallelConfig).maxWorkers).toBeLessThanOrEqual(4)
    for (const config of [clientConfig, parallelConfig, serialConfig]) {
      expect(projectTest(config).setupFiles).toContain(
        path.join(repoRoot, 'vitest-setup-storage-isolation.js'),
      )
    }
  })

  it('preserves coverage reporters and executable thresholds', () => {
    expect(rootConfig.test.coverage).toMatchObject({
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 74,
        branches: 60,
        functions: 68,
        statements: 71,
      },
    })
  })
})
