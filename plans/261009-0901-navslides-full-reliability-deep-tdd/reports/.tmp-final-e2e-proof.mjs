import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
const require = createRequire(import.meta.url)
const backendIdentity = require('../../../server/recovery-source-manifest.cjs')
const out = path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports')
const hash = value => createHash('sha256').update(value).digest('hex')
async function capture() {
  const files = new Map()
  async function file(name) {
    const stat = await lstat(name)
    assert(stat.isFile() && !stat.isSymbolicLink(), `Not a regular input: ${name}`)
    files.set(name.replaceAll('\\', '/'), hash(await readFile(name)))
  }
  async function walk(name) {
    for (const entry of await readdir(name, { withFileTypes: true })) {
      const child = path.join(name, entry.name)
      if (entry.isDirectory()) await walk(child)
      else await file(child)
    }
  }
  for (const root of ['client/src', 'client/dist', 'tests/e2e', '.github/workflows']) await walk(root)
  for (const name of ['client/package.json', 'runtime-versions.json', 'client-dist-manifest.json', 'playwright.config.js', 'scripts/verify-runtime-closure.js']) await file(name)
  const backend = await backendIdentity()
  const inputs = Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)))
  return { scope: 'complete backend/shared source and locked dependencies; client source and served distribution; all e2e fixtures/helpers/specs; workflows; Playwright and runtime manifest/configuration', backend, inputs, sha256: hash(JSON.stringify({ backend, inputs })) }
}
assert.equal(process.argv.length, 3)
assert.match(process.argv[2], /^final-e2e[-a-z0-9]*$/)
const name = process.argv[2]
const args = ['node_modules/@playwright/test/cli.js', 'test', '--workers=1', '--retries=0', '--grep-invert', 'phase13 isolated production navigator baseline', '--reporter=line,json', `--output=${path.join(out, `${name}-artifacts`)}`]
const record = { status: 'running', command: [process.execPath, ...args], startedAt: new Date().toISOString(), limits: 'All configured local Playwright projects; navigator measurement alone in a separate invocation; no hosted CI, physical Office, packaged Windows or container qualification.', sourceBefore: await capture() }
try {
  record.result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { windowsHide: true, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(out, `${name}.json`), PLAYWRIGHT_HTML_OPEN: 'never' }, stdio: ['ignore', 'pipe', 'pipe'] })
    record.stdout = ''; record.stderr = ''
    child.stdout.on('data', data => { record.stdout += data; process.stdout.write(data) })
    child.stderr.on('data', data => { record.stderr += data; process.stderr.write(data) })
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  record.sourceAfter = await capture()
  assert.equal(record.sourceAfter.sha256, record.sourceBefore.sha256, 'E2E inputs changed during execution')
  assert.equal(record.result.code, 0, `Full E2E exited ${record.result.code}/${record.result.signal}`)
  record.status = 'passed'
} catch (error) {
  record.status = 'failed'; record.failure = error.message; process.exitCode = 1
} finally {
  record.finishedAt = new Date().toISOString()
  await writeFile(path.join(out, `${name}-runtime.json`), JSON.stringify(record, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ status: record.status, receipt: path.join(out, `${name}-runtime.json`) }))
}
