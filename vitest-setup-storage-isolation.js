import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll } from 'vitest'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))
const productionRoots = [
  path.resolve(repoRoot, 'server', 'data'),
  path.resolve(repoRoot, 'server', 'uploads'),
]

function isWithinOrEqual(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function assertProductionSafe(target, label) {
  const resolved = path.resolve(target)
  const productionRoot = productionRoots.find(
    (root) => isWithinOrEqual(root, resolved) || isWithinOrEqual(resolved, root)
  )
  if (productionRoot) {
    throw new Error(`[vitest-storage] ${label} must not use production root ${productionRoot}`)
  }
  return resolved
}

function chooseBase() {
  const candidates = [
    tmpdir(),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Temp'),
    path.join(homedir(), '.navslides-vitest'),
    path.resolve(repoRoot, '..'),
  ].filter(Boolean)
  const selected = candidates.find((candidate) =>
    productionRoots.every((root) => !isWithinOrEqual(root, path.resolve(candidate)))
  )
  if (!selected) throw new Error('[vitest-storage] no production-safe temporary base is available')
  return path.resolve(selected)
}

function validateCallerStorage() {
  const dataDir = process.env.SLIDES_DATA_DIR
  const uploadsDir = process.env.SLIDES_UPLOADS_DIR
  if (!dataDir && !uploadsDir) return null
  if (!dataDir || !uploadsDir) {
    throw new Error('[vitest-storage] caller storage requires both data and uploads roots')
  }
  if (
    process.env.NAVSLIDES_VITEST_STORAGE_MODE !== 'serial' ||
    process.env.NAVSLIDES_VITEST_ALLOW_CALLER_STORAGE !== '1'
  ) {
    throw new Error('[vitest-storage] caller storage requires explicit serial opt-in')
  }
  return {
    dataDir: assertProductionSafe(dataDir, 'SLIDES_DATA_DIR'),
    uploadsDir: assertProductionSafe(uploadsDir, 'SLIDES_UPLOADS_DIR'),
  }
}

function configureOwnedStorage() {
  const invocation = (process.env.NAVSLIDES_VITEST_INVOCATION_ID || 'run')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 40)
  const worker = process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID || process.pid
  const base = chooseBase()
  const root = assertProductionSafe(
    path.join(base, `navslides-vitest-${invocation}-${worker}-${process.pid}-${randomUUID()}`),
    'generated root'
  )
  process.env.NAVSLIDES_VITEST_STORAGE_ROOT = root
  process.env.NAVSLIDES_VITEST_STORAGE_OWNED = '1'
  process.env.NAVSLIDES_VITEST_STORAGE_OWNER_PID = String(process.pid)
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    try {
      const ownedRoot = process.env.NAVSLIDES_VITEST_STORAGE_ROOT
      const ownedByThisProcess =
        process.env.NAVSLIDES_VITEST_STORAGE_OWNER_PID === String(process.pid)
      if (
        process.env.NAVSLIDES_VITEST_STORAGE_OWNED !== '1' ||
        !ownedByThisProcess ||
        ownedRoot !== root ||
        path.dirname(root) !== base
      )
        return
      assertProductionSafe(root, 'cleanup root')
      rmSync(root, { force: true, maxRetries: 3, recursive: true, retryDelay: 100 })
      delete process.env.NAVSLIDES_VITEST_STORAGE_ROOT
      delete process.env.NAVSLIDES_VITEST_STORAGE_OWNED
      delete process.env.NAVSLIDES_VITEST_STORAGE_OWNER_PID
      delete process.env.SLIDES_DATA_DIR
      delete process.env.SLIDES_UPLOADS_DIR
      cleaned = true
    } catch (error) {
      process.stderr.write(`[vitest-storage] cleanup failed: ${error.message}\n`)
    }
  }
  afterAll(cleanup)
  process.once('exit', cleanup)
}

const callerStorage = validateCallerStorage()
if (callerStorage) {
  process.env.SLIDES_DATA_DIR = callerStorage.dataDir
  process.env.SLIDES_UPLOADS_DIR = callerStorage.uploadsDir
  delete process.env.NAVSLIDES_VITEST_STORAGE_OWNED
  delete process.env.NAVSLIDES_VITEST_STORAGE_ROOT
  delete process.env.NAVSLIDES_VITEST_STORAGE_OWNER_PID
} else {
  configureOwnedStorage()
}
