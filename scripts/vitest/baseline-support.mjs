import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ownedPrefixes = [
  'config/vitest/legacy-vitest.config.mjs',
  'scripts/vitest/',
  'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports/vitest-',
  '.tmp/vitest-',
  'coverage/',
]
const testPattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/

export function normalize(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '')
}

export function hashBytes(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function hashFile(file) {
  return hashBytes(readFileSync(file))
}

function git(args, root = repoRoot, input) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  return result.stdout
}

function isOwned(relative) {
  const value = normalize(relative)
  return ownedPrefixes.some((prefix) => value === prefix || value.startsWith(prefix))
}

function cleanBlobOids(files, root) {
  const existing = files.filter((relative) => existsSync(path.join(root, relative)))
  if (existing.length === 0) return new Map()
  const hashes = git(
    ['hash-object', '--stdin-paths'],
    root,
    `${existing.join('\n')}\n`,
  ).trimEnd().split(/\r?\n/)
  if (hashes.length !== existing.length) {
    throw new Error(`git hash-object returned ${hashes.length} hashes for ${existing.length} files`)
  }
  return new Map(existing.map((relative, index) => [relative, hashes[index]]))
}

export function captureSourceFingerprint(root = repoRoot) {
  const listed = git(['ls-files', '-co', '--exclude-standard', '-z'], root)
    .split('\0')
    .filter(Boolean)
    .map(normalize)
  const files = [...new Set(listed)].filter((file) => !isOwned(file)).sort()
  const blobOids = cleanBlobOids(files, root)
  const digest = createHash('sha256')
  for (const relative of files) {
    digest.update(`${relative}\0`)
    digest.update(blobOids.get(relative) ?? '<missing>')
    digest.update('\0')
  }
  return { algorithm: 'sha256', fileCount: files.length, hash: digest.digest('hex') }
}

function shouldSkip(relative, name) {
  if (['.git', 'node_modules', 'dist', 'dist-electron'].includes(name)) return true
  const value = normalize(path.join(relative, name))
  return value === 'tests/e2e' || value.startsWith('tests/e2e/') ||
    value === '.claude/worktrees' || value.startsWith('.claude/worktrees/')
}

function walkTests(directory, relative = '', files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (shouldSkip(relative, entry.name)) continue
    const childRelative = normalize(path.join(relative, entry.name))
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) walkTests(child, childRelative, files)
    else if (entry.isFile() && testPattern.test(entry.name)) files.push(childRelative)
  }
  return files
}

export function captureTestInventory() {
  const files = walkTests(repoRoot).sort().map((relative) => ({
    path: relative,
    sourceSha256: hashFile(path.join(repoRoot, relative)),
  }))
  return {
    algorithm: 'sha256',
    hash: hashBytes(JSON.stringify(files)),
    fileCount: files.length,
    files,
  }
}

function readVersion(packageName) {
  const file = path.join(repoRoot, 'node_modules', packageName, 'package.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).version : null
}

export function captureFacts() {
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const npmVersion = spawnSync(npmExecutable, ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
  const browsers = existsSync(browserRoot)
    ? readdirSync(browserRoot).filter((name) => !name.startsWith('.')).sort()
    : []
  const dirtyStatus = git(['status', '--short', '--untracked-files=all'])
    .split(/\r?\n/)
    .filter(Boolean)
  const statusPath = (line) => line.slice(3).split(' -> ').at(-1)
  return {
    capturedAt: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD']).trim(),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    dirtyStatus,
    externalDirtyStatus: dirtyStatus.filter((line) => !isOwned(statusPath(line))),
    baselineOwnedStatus: dirtyStatus.filter((line) => isOwned(statusPath(line))),
    versions: {
      node: process.version,
      npm: npmVersion.stdout?.trim() || null,
      vitest: readVersion('vitest'),
      coverageV8: readVersion('@vitest/coverage-v8'),
    },
    host: {
      platform: process.platform,
      release: os.release(),
      arch: os.arch(),
      cpuModel: os.cpus()[0]?.model || null,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      hostname: os.hostname(),
      powerMode: process.env.POWER_MODE || 'not-declared',
    },
    browserInstallation: { root: browserRoot, entries: browsers },
  }
}

export function schemaKeys(value) {
  return value && typeof value === 'object' ? Object.keys(value).sort() : []
}
