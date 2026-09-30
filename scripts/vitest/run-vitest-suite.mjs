import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const node = process.execPath

function run(script, args) {
  return spawnSync(node, [script, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
}

const inventory = run(path.join(repoRoot, 'scripts', 'vitest', 'build-test-inventory.mjs'), [])
if (inventory.error) throw inventory.error
if (inventory.status !== 0) process.exit(inventory.status ?? 2)

const vitest = run(path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'), [
  'run',
  ...process.argv.slice(2),
])
if (vitest.error) throw vitest.error
process.exitCode = vitest.status ?? 2
