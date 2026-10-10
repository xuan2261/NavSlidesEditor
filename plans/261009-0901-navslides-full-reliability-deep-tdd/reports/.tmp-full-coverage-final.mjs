import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, readdir, lstat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { captureTestInventory } from '../../../scripts/vitest/baseline-support.mjs'
const require = createRequire(import.meta.url)
const backendIdentity = require('../../../server/recovery-source-manifest.cjs')
const reports = path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports')
const hash = value => createHash('sha256').update(value).digest('hex')
async function capture() {
  const inventory = captureTestInventory()
  const files = new Map()
  async function file(name) {
    const stat = await lstat(name)
    assert.equal(stat.isSymbolicLink(), false, `Input symlink: ${name}`)
    assert.equal(stat.isFile(), true, `Input is not regular: ${name}`)
    files.set(name.replaceAll('\\', '/'), hash(await readFile(name)))
  }
  async function walk(name) {
    for (const entry of await readdir(name, { withFileTypes: true })) {
      const child = path.join(name, entry.name)
      if (entry.isDirectory()) await walk(child)
      else await file(child)
    }
  }
  for (const root of ['client/src', 'tests/unit', 'config/vitest', '.github/workflows', 'scripts/ci']) await walk(root)
  for (const name of ['vitest.config.mjs', 'vitest-setup-storage-isolation.js',
    'vitest-setup-jsdom-pointer-event-polyfills-for-radix-ui.js', 'runtime-versions.json',
    'client/package.json', 'client-dist-manifest.json', 'scripts/vitest/run-vitest-suite.mjs',
    'config/release-target-policy.json', 'config/container-vulnerability-policy.json']) await file(name)
  const backend = await backendIdentity()
  const client = JSON.parse(await readFile('client-dist-manifest.json', 'utf8'))
  const inputs = Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)))
  return { scope: 'full Vitest file inventory; backend/shared source/locked inputs; client source; unit fixtures; Vitest configuration/setup; workflows; receipt producers/consumers and trusted target/scan policies; built client manifest',
    inventory, backend, inputs, clientArtifactIdentity: client.artifact.identity,
    sha256: hash(JSON.stringify({ inventory, backend, inputs, clientArtifactIdentity: client.artifact.identity })) }
}
const args = ['scripts/vitest/run-vitest-suite.mjs', '--coverage', '--maxWorkers=1', '--no-file-parallelism',
  '--reporter=default', '--reporter=json', `--outputFile=${path.join(reports, 'final-coverage-frozen04.json')}`]
const receipt = { status: 'running', command: [process.execPath, ...args], startedAt: new Date().toISOString(),
  limits: 'Working-tree unfiltered local coverage; not hosted CI, clean-SHA or packaged qualification.', sourceBefore: await capture() }
try {
  receipt.result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true, env: { ...process.env, VITEST_MAX_WORKERS: '1' } })
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  receipt.sourceAfter = await capture()
  assert.equal(receipt.sourceAfter.sha256, receipt.sourceBefore.sha256, 'Affected coverage inputs changed during execution')
  assert.equal(receipt.result.code, 0, `Full coverage exited ${receipt.result.code}/${receipt.result.signal}`)
  receipt.status = 'passed'
} catch (error) {
  receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1
} finally {
  receipt.finishedAt = new Date().toISOString()
  await writeFile(path.join(reports, 'final-coverage-frozen04-runtime.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ status: receipt.status, receipt: path.join(reports, 'final-coverage-frozen04-runtime.json') }))
}
