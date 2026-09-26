import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BROWSER_ENVIRONMENT_REGISTRY,
  SERIAL_HAZARD_EXEMPTIONS,
  SERIAL_HAZARD_REGISTRY,
} from './vitest-lane-registry.mjs'

export {
  BROWSER_ENVIRONMENT_REGISTRY,
  SERIAL_HAZARD_EXEMPTIONS,
  SERIAL_HAZARD_REGISTRY,
} from './vitest-lane-registry.mjs'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const FROZEN_INVENTORY_PATH =
  'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports/vitest-legacy-inventory-attempt-2.json'
export const VITEST_PROJECT_NAMES = ['client-jsdom', 'node-parallel', 'node-serial']

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const KNOWN_ROOTS = new Set(['client', 'scripts', 'server', 'shared', 'tests'])
const EXCLUDED_SEGMENTS = new Set([
  '.git',
  'coverage',
  'dist',
  'dist-electron',
  'node_modules',
])

const SOURCE_HAZARDS = [
  {
    id: 'file-storage',
    reason: 'file-backed storage import',
    pattern: /(?:from|require\()\s*['"][^'"]*(?:services\/storage|package-store)/,
  },
  {
    id: 'child-process',
    reason: 'child process lifecycle',
    pattern:
      /(?:from\s*['"](?:node:)?child_process['"]|require\(\s*['"](?:node:)?child_process['"]\s*\))/,
  },
  {
    id: 'process-environment',
    reason: 'process environment mutation',
    pattern: /(?:process\.env\.[A-Z0-9_]+\s*=|delete\s+process\.env|vi\.stubEnv\()/,
  },
  {
    id: 'network-listener',
    reason: 'network listener or fixed port lifecycle',
    pattern: /(?:\.listen\s*\(|createServer\s*\()/,
  },
  {
    id: 'singleton-runtime',
    reason: 'socket, room, or singleton runtime state',
    pattern:
      /(?:from|require\()\s*['"][^'"]*(?:socket-handler|live-rooms|game-room-manager-singleton)/,
  },
]

export function normalizeVitestPath(file, root = repoRoot) {
  const normalizedRoot = path.resolve(root).replaceAll('\\', '/').replace(/\/+$/, '')
  let normalized = String(file).replaceAll('\\', '/').replace(/^\.\//, '')
  if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')) {
    const absolute = path.resolve(normalized).replaceAll('\\', '/')
    if (absolute.toLowerCase() === normalizedRoot.toLowerCase()) return ''
    if (absolute.toLowerCase().startsWith(`${normalizedRoot.toLowerCase()}/`)) {
      normalized = absolute.slice(normalizedRoot.length + 1)
    }
  }
  return normalized.replace(/^\/+/, '')
}

function exclusionReason(file) {
  const segments = file.split('/')
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) return 'generated or dependency path'
  if (file === '.claude/worktrees' || file.startsWith('.claude/worktrees/')) return 'worktree'
  if (file === 'tests/e2e' || file.startsWith('tests/e2e/')) return 'e2e'
  return null
}

function environmentDirective(source) {
  const match = source.match(
    /^\s*(?:\/\/|\/\*+|\*)\s*@(?:vitest|jest)-environment\s+([a-zA-Z0-9-]+)/m,
  )
  if (!match) return null
  if (!['jsdom', 'node'].includes(match[1])) {
    throw new Error(`Unsupported Vitest environment directive: ${match[1]}`)
  }
  return match[1]
}

export function scanSerialHazards(file, source = '') {
  const normalized = normalizeVitestPath(file)
  const exempt = new Set(SERIAL_HAZARD_EXEMPTIONS[normalized]?.hazards ?? [])
  const hazards = SERIAL_HAZARD_REGISTRY
    .filter((rule) => rule.path.test(normalized))
    .map(({ id, reason }) => ({ id, reason }))
  for (const hazard of SOURCE_HAZARDS) {
    if (hazard.pattern.test(source)) hazards.push({ id: hazard.id, reason: hazard.reason })
  }
  return hazards.filter(({ id }) => !exempt.has(id))
}

export function classifyVitestFile(file, source = '') {
  const normalized = normalizeVitestPath(file)
  const excluded = exclusionReason(normalized)
  if (excluded) return { path: normalized, excluded: true, reason: excluded }
  const root = normalized.split('/')[0]
  if (!KNOWN_ROOTS.has(root)) throw new Error(`Unknown test root for ${normalized}`)
  if (!TEST_FILE.test(normalized)) throw new Error(`Not a Vitest test file: ${normalized}`)

  const directive = environmentDirective(source)
  const browserRule = BROWSER_ENVIRONMENT_REGISTRY.find((rule) => rule.path.test(normalized))
  const environment = directive ?? (browserRule ? 'jsdom' : root === 'client' ? 'jsdom' : 'node')
  if (environment === 'jsdom') {
    return {
      path: normalized,
      lane: 'client-jsdom',
      environment,
      reason: directive
        ? 'explicit jsdom environment directive'
        : browserRule?.reason ?? 'client browser test',
      serialReason: null,
    }
  }
  const hazards = scanSerialHazards(normalized, source)
  const serialReason = hazards.map(({ reason }) => reason).join('; ') || null
  return {
    path: normalized,
    lane: serialReason ? 'node-serial' : 'node-parallel',
    environment,
    reason: directive ? 'explicit node environment directive' : 'node test root',
    serialReason,
  }
}

function shouldSkipDirectory(relative, name) {
  if (EXCLUDED_SEGMENTS.has(name)) return true
  const child = normalizeVitestPath(path.join(relative, name))
  return child === 'tests/e2e' || child.startsWith('tests/e2e/') ||
    child === '.claude/worktrees' || child.startsWith('.claude/worktrees/')
}

export function discoverVitestFiles(root = repoRoot) {
  const files = []
  function walk(directory, relative = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && shouldSkipDirectory(relative, entry.name)) continue
      const childRelative = normalizeVitestPath(path.join(relative, entry.name), root)
      const child = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(child, childRelative)
      else if (entry.isFile() && TEST_FILE.test(entry.name)) files.push(childRelative)
    }
  }
  walk(root)
  return files.sort()
}

export function buildVitestTopology({ files = discoverVitestFiles(), root = repoRoot, readSources = true } = {}) {
  const lanes = Object.fromEntries(VITEST_PROJECT_NAMES.map((name) => [name, []]))
  const entries = files.map((file) => {
    const normalized = normalizeVitestPath(file, root)
    const source = readSources ? readFileSync(path.join(root, normalized), 'utf8') : ''
    const classified = classifyVitestFile(normalized, source)
    const entry = {
      ...classified,
      sourceSha256: readSources
        ? createHash('sha256').update(source).digest('hex')
        : null,
    }
    lanes[entry.lane].push(entry)
    return entry
  })
  for (const lane of Object.values(lanes)) lane.sort((a, b) => a.path.localeCompare(b.path))
  return { files: entries, lanes, overlaps: [], unclassified: [] }
}
