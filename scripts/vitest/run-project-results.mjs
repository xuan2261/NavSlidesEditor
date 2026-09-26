import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { VITEST_PROJECT_NAMES } from '../../config/vitest/vitest-lanes.mjs'
import { mergeVitestResults } from './run-results.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { values } = parseArgs({ options: { out: { type: 'string' } } })
if (!values.out) throw new Error('Usage: run-project-results.mjs --out <file>')

function spawnNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
}

const inventory = spawnNode([path.join(repoRoot, 'scripts', 'vitest', 'build-test-inventory.mjs')])
if (inventory.error) throw inventory.error
if (inventory.status !== 0) process.exit(inventory.status ?? 2)

const rawRoot = path.join(repoRoot, '.tmp', 'vitest-project-results')
const outputPath = path.resolve(repoRoot, values.out)
mkdirSync(rawRoot, { recursive: true })
rmSync(outputPath, { force: true })
const reports = []
let failed = false
for (const projectName of VITEST_PROJECT_NAMES) {
  const reportPath = path.join(rawRoot, `${projectName}.json`)
  rmSync(reportPath, { force: true })
  const run = spawnNode([
    path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    '--project',
    projectName,
    '--reporter=json',
    `--outputFile=${reportPath}`,
  ])
  if (run.error) throw run.error
  failed = failed || run.status !== 0
  if (!existsSync(reportPath)) {
    throw new Error(`Vitest project ${projectName} did not write ${reportPath}`)
  }
  reports.push({
    projectName,
    result: JSON.parse(readFileSync(reportPath, 'utf8')),
  })
}

const merged = mergeVitestResults(reports, VITEST_PROJECT_NAMES)
mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(merged)}\n`)
console.log(`[vitest-results] wrote ${values.out}`)
if (failed || !merged.success) process.exitCode = 1
