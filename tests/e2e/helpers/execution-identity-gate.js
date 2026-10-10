import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

const repo = path.resolve('.')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const roots = ['server', 'shared', 'client', 'tests/e2e']
const required = ['package.json', 'package-lock.json', 'server/package.json', 'shared/package.json',
  'client/package.json', 'playwright.config.js', 'server/index.js', 'client/src/main.jsx',
  'runtime-versions.json', 'client-dist-manifest.json', 'scripts/verify-runtime-closure.js',
  'shared/src/htmlGenerator.js', 'client/dist/index.html', 'server/vendor/vendor-manifest.json']
const requiredDirectories = ['client/dist', 'client/public', 'server/vendor']
const excluded = ['node_modules', '.git', 'test-results', 'playwright-report', 'coverage']
const runtimeRoots = ['server/data', 'server/uploads']

// Filesystem identity deliberately includes untracked/dirty source, all served bytes and harnesses.
// Never follow symlink directories (or files), and never turn a missing required input into N/A.
async function capture(browser, extraRequired) {
  const snapshot = { capturedAt: new Date().toISOString(), status: 'failed',
    scope: { roots, required: [...required, ...extraRequired], requiredDirectories,
      exclusions: { directoryNames: excluded, exactRuntimeRoots: runtimeRoots },
      production: 'all regular files under server/shared/client, including build and vendor assets',
      harness: 'all tests/e2e files plus server harnesses; declared external fixture inputs' },
    files: [], errors: [], excludedPaths: [], counts: {} }
  for (const directory of requiredDirectories) {
    try {
      const stat = await lstat(path.join(repo, directory))
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Required nonsymlink directory missing')
    } catch (error) { snapshot.errors.push(`${directory}: ${error.message}`) }
  }
  const names = new Set([...required, ...extraRequired])
  async function visit(relative) {
    const absolute = path.join(repo, relative)
    const stat = await lstat(absolute)
    if (stat.isSymbolicLink()) throw new Error(`Identity refuses symlink: ${relative}`)
    if (!stat.isDirectory()) throw new Error(`Identity requires directory: ${relative}`)
    const entries = await readdir(absolute, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = `${relative}/${entry.name}`
      if (excluded.includes(entry.name) || runtimeRoots.includes(name)) {
        snapshot.excludedPaths.push(name)
        continue
      }
      try {
        const item = await lstat(path.join(repo, name))
        if (item.isSymbolicLink()) throw new Error(`Identity refuses symlink: ${name}`)
        if (item.isDirectory()) await visit(name)
        else if (item.isFile()) names.add(name)
        else throw new Error(`Identity refuses nonregular input: ${name}`)
      } catch (error) { snapshot.errors.push(`${name}: ${error.message}`) }
    }
  }
  for (const root of roots) {
    try { await visit(root) } catch (error) { snapshot.errors.push(`${root}: ${error.message}`) }
  }
  // Ancestor checks also apply to required fixture/build inputs, not only enumerated trees.
  for (const name of [...names].sort()) {
    try {
      const parts = name.split('/')
      for (let i = 1; i <= parts.length; i += 1) {
        const stat = await lstat(path.join(repo, ...parts.slice(0, i)))
        if (stat.isSymbolicLink() || (i < parts.length ? !stat.isDirectory() : !stat.isFile())) {
          throw new Error('Not an owned regular file with nonsymlink directory ancestors')
        }
      }
      const bytes = await readFile(path.join(repo, name))
      snapshot.files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) })
    } catch (error) { snapshot.errors.push(`${name}: ${error.message}`) }
  }
  try { snapshot.gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim() }
  catch (error) { snapshot.errors.push(`git HEAD: ${error.message}`) }
  snapshot.runtime = { node: process.version, versions: process.versions, platform: process.platform, architecture: process.arch }
  try {
    snapshot.runtime.nodeExecutableSha256 = hash(await readFile(process.execPath))
    snapshot.runtime.browserVersion = browser.version()
    const session = await browser.newBrowserCDPSession()
    try {
      const { processInfo } = await session.send('SystemInfo.getProcessInfo')
      const pid = processInfo.find((entry) => entry.type === 'browser')?.id
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Running browser PID is unavailable')
      let executable
      if (process.platform === 'win32') {
        executable = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          `(Get-Process -Id ${pid} -ErrorAction Stop).Path`], { encoding: 'utf8', windowsHide: true }).trim()
      } else if (process.platform === 'linux') {
        executable = await realpath(`/proc/${pid}/exe`)
      } else {
        throw new Error(`Running browser path lookup is unsupported on ${process.platform}`)
      }
      if (!path.isAbsolute(executable)) throw new Error('Running browser executable is unavailable')
      snapshot.runtime.browserProcessId = pid
      snapshot.runtime.browserExecutablePath = executable
      snapshot.runtime.browserExecutableSha256 = hash(await readFile(executable))
    } finally { await session.detach() }
  } catch (error) { snapshot.errors.push(`runtime executable: ${error.message}`) }
  for (const root of roots) snapshot.counts[root] = snapshot.files.filter((file) => file.path.startsWith(`${root}/`)).length
  snapshot.counts.servedBuild = snapshot.files.filter((file) => file.path.startsWith('client/dist/')).length
  snapshot.counts.vendor = snapshot.files.filter((file) => file.path.startsWith('server/vendor/') || file.path.startsWith('client/public/vendor/') || file.path.startsWith('client/dist/vendor/')).length
  snapshot.sourceSha256 = hash(JSON.stringify(snapshot.files))
  snapshot.sha256 = hash(JSON.stringify({ files: snapshot.files, gitHead: snapshot.gitHead, runtime: snapshot.runtime }))
  snapshot.status = snapshot.errors.length ? 'failed' : 'captured'
  return snapshot
}

export async function executionIdentityGate(receipt, phase, browser, extraRequired = []) {
  receipt.executionIdentity ??= { status: 'running', before: null, after: null }
  const gate = receipt.executionIdentity
  gate[phase] = await capture(browser, extraRequired)
  const failure = gate[phase].errors.length ? `Execution identity ${phase} capture failed: ${gate[phase].errors.join('; ')}`
    : phase === 'after' && (!gate.before || gate.before.status !== 'captured' || gate.before.sha256 !== gate.after.sha256)
      ? 'Execution identity changed or before capture was invalid; measurements cannot qualify' : null
  if (failure) {
    gate.status = 'failed'; gate.error = failure; receipt.status = 'failed'
    for (const run of receipt.runs || []) {
      run.behavioralStatus ??= run.status
      run.status = 'failed'; run.identityError = failure
    }
    throw new Error(failure)
  }
  gate.status = phase === 'after' ? 'matched' : 'captured-before'
  if (phase === 'after') {
    for (const run of receipt.runs || []) {
      if (run.status === 'pending-identity') run.status = 'passed'
    }
  }
}

// Failure finalizers must save/attach their receipt before rethrowing this returned error.
export async function finishExecutionIdentity(receipt, browser, extraRequired = []) {
  if (receipt.executionIdentity?.after) return null
  try { await executionIdentityGate(receipt, 'after', browser, extraRequired); return null }
  catch (error) { return error }
}
