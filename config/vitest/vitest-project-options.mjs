import { cpus } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { buildVitestTopology, repoRoot } from './vitest-lanes.mjs'

const requestedWorkers = Number.parseInt(process.env.VITEST_MAX_WORKERS ?? '', 10)
const defaultCap = process.env.CI ? 2 : 4
const cpuBound = Math.max(1, cpus().length - 1)

export const boundedWorkerCount = Math.max(
  1,
  Math.min(Number.isFinite(requestedWorkers) ? requestedWorkers : cpuBound, defaultCap),
)

export const pointerSetup = path.join(
  repoRoot,
  'vitest-setup-jsdom-pointer-event-polyfills-for-radix-ui.js',
)
export const storageSetup = path.join(repoRoot, 'vitest-setup-storage-isolation.js')
const topology = buildVitestTopology()

export function laneInclude(name) {
  return topology.lanes[name].map((entry) => entry.path)
}

export function nodeSetupFiles() {
  return [storageSetup]
}
