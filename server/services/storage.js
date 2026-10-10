const fs = require('fs-extra')
const path = require('path')

// Support custom data directory (used by Electron to write to user's app data folder)
const DATA_DIR = process.env.SLIDES_DATA_DIR || path.join(__dirname, '..', 'data')
const UPLOADS_BASE = process.env.SLIDES_UPLOADS_DIR || path.join(__dirname, '..', 'uploads')

const DATA_FILE = path.join(DATA_DIR, 'presentations.json')
const GITHUB_CONFIG_FILE = path.join(DATA_DIR, 'github-config.json')
const UPLOADS_DIR = UPLOADS_BASE
const SHARE_FILE = path.join(DATA_DIR, 'share-tokens.json')
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')
const RCLONE_CONFIG_FILE = path.join(DATA_DIR, 'rclone.conf')
const SYNC_DIR = path.join(DATA_DIR, 'sync-export')
const HISTORY_DIR = path.join(DATA_DIR, 'history')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json')
const MEDIA_DB_FILE = path.join(DATA_DIR, 'media.json')
const UPLOAD_HASHES_FILE = path.join(DATA_DIR, 'upload-hashes.json')
const SECRET_FILE_NAMES = new Set([
  path.basename(SHARE_FILE),
  path.basename(GITHUB_CONFIG_FILE),
  path.basename(SETTINGS_FILE),
  path.basename(RCLONE_CONFIG_FILE),
  'project-import-sessions.json',
])
const OWNER_ONLY_MODE = 0o600

function isSecretBearingPath(filePath) {
  const resolved = path.resolve(filePath)
  if (path.dirname(resolved) !== path.resolve(DATA_DIR)) return false
  const name = path.basename(resolved).toLowerCase()
  return [...SECRET_FILE_NAMES].some(
    (secretName) => name === secretName || name.startsWith(`${secretName}.`)
  )
}

function applySecretModeSync(filePath) {
  if (process.platform === 'win32' || !isSecretBearingPath(filePath) || !fs.existsSync(filePath)) {
    return
  }
  fs.chmodSync(filePath, OWNER_ONLY_MODE)
}

// ── File locking to prevent race conditions ──────────────────────────────────
const fileLocks = new Map()
async function withFileLock(filePath, fn) {
  if (!fileLocks.has(filePath)) {
    fileLocks.set(filePath, Promise.resolve())
  }
  const prev = fileLocks.get(filePath)
  let releaseLock
  const lockPromise = new Promise((resolve) => {
    releaseLock = resolve
  })
  fileLocks.set(
    filePath,
    prev.then(() => lockPromise)
  )
  await prev
  try {
    return await fn()
  } finally {
    releaseLock()
  }
}

// ── Atomic JSON writes (write to tmp + rename) ───────────────────────────────
// rename() of files within the same directory is atomic on POSIX and
// effectively atomic on Windows NTFS; readers see either old or new content,
// never a truncated state. This guards against crash mid-write (node --watch
// reload, Ctrl+C, OS kill) corrupting the JSON file.
let atomicCounter = 0

async function renameWithRetry(src, dest, attempts = 5, { signal } = {}) {
  // Windows occasionally fails rename with EPERM/EBUSY when antivirus or
  // another reader holds the target briefly. Retry with bounded backoff.
  let lastErr
  for (let i = 0; i < attempts; i++) {
    signal?.throwIfAborted()
    try {
      await fs.rename(src, dest)
      return
    } catch (err) {
      signal?.throwIfAborted()
      lastErr = err
      const retriable = ['EPERM', 'EBUSY', 'EACCES', 'EEXIST'].includes(err.code)
      if (!retriable || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, 25 * (i + 1)))
    }
  }
  throw lastErr
}

async function writeJsonAtomic(filePath, data, { signal, ...options } = {}) {
  const tmpPath = `${filePath}.tmp.${process.pid}.${++atomicCounter}`
  const secret = isSecretBearingPath(filePath)
  try {
    signal?.throwIfAborted()
    await fs.writeJson(tmpPath, data, secret ? { ...options, mode: OWNER_ONLY_MODE } : options)
    signal?.throwIfAborted()
    if (secret && process.platform !== 'win32') await fs.chmod(tmpPath, OWNER_ONLY_MODE)
    signal?.throwIfAborted()
    // A native rename already in flight cannot be revoked; success is committed.
    await renameWithRetry(tmpPath, filePath, 5, { signal })
  } catch (err) {
    await fs.remove(tmpPath).catch(() => {})
    throw err
  }
}

// ── Initialize data files ────────────────────────────────────────────────────
function initDataFiles() {
  fs.ensureDirSync(DATA_DIR)
  fs.ensureDirSync(UPLOADS_DIR)
  fs.ensureDirSync(HISTORY_DIR)
  // Zero-loss PPTX originals (presentation lifetime)
  fs.ensureDirSync(path.join(DATA_DIR, 'pptx-originals'))

  if (!fs.existsSync(DATA_FILE)) fs.writeJsonSync(DATA_FILE, [])
  if (!fs.existsSync(SHARE_FILE)) {
    fs.writeJsonSync(SHARE_FILE, {}, { mode: OWNER_ONLY_MODE })
  }
  if (!fs.existsSync(TEMPLATES_FILE)) fs.writeJsonSync(TEMPLATES_FILE, [])
  if (!fs.existsSync(ANALYTICS_FILE)) fs.writeJsonSync(ANALYTICS_FILE, {})
  if (!fs.existsSync(MEDIA_DB_FILE)) fs.writeJsonSync(MEDIA_DB_FILE, [])
  if (!fs.existsSync(GITHUB_CONFIG_FILE)) {
    fs.writeJsonSync(
      GITHUB_CONFIG_FILE,
      { token: '', owner: '', repo: '' },
      { mode: OWNER_ONLY_MODE }
    )
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeJsonSync(
      SETTINGS_FILE,
      {
        aiApiKey: '',
        defaultTheme: 'black',
        defaultTransition: 'slide',
      },
      { mode: OWNER_ONLY_MODE }
    )
  }
  for (const name of fs.readdirSync(DATA_DIR)) {
    applySecretModeSync(path.join(DATA_DIR, name))
  }

  // Clean up stale .tmp files from prior crashes. Async + non-blocking so
  // startup is not delayed by directory scans on slow disks. Only removes
  // files belonging to OTHER process IDs — in-flight writes from this
  // process must never be deleted mid-rename.
  setImmediate(async () => {
    try {
      const names = await fs.readdir(DATA_DIR)
      const tmpRe = /\.tmp\.(\d+)\.\d+$/
      const stale = names.filter((n) => {
        const m = n.match(tmpRe)
        return m && Number(m[1]) !== process.pid
      })
      await Promise.all(
        stale.map((n) => fs.remove(path.join(DATA_DIR, n)).catch(() => {}))
      )
    } catch {
      /* non-fatal */
    }
  })
}

// ── Presentations ────────────────────────────────────────────────────────────
async function readPresentations() {
  return withFileLock(DATA_FILE, async () => {
    return fs.readJson(DATA_FILE)
  })
}

async function writePresentations(data) {
  return withFileLock(DATA_FILE, async () => writeJsonAtomic(DATA_FILE, data, { spaces: 2 }))
}

async function withPresentations(fn, { signal } = {}) {
  return withFileLock(DATA_FILE, async () => {
    signal?.throwIfAborted()
    const presentations = await fs.readJson(DATA_FILE)
    signal?.throwIfAborted()
    const result = await fn(presentations)
    signal?.throwIfAborted()
    await writeJsonAtomic(DATA_FILE, presentations, { spaces: 2, signal })
    return result
  })
}

// ── Templates ────────────────────────────────────────────────────────────────
async function readTemplates() {
  return withFileLock(TEMPLATES_FILE, async () => fs.readJson(TEMPLATES_FILE))
}

async function writeTemplates(data) {
  return withFileLock(TEMPLATES_FILE, async () => writeJsonAtomic(TEMPLATES_FILE, data, { spaces: 2 }))
}

async function withTemplates(fn) {
  return withFileLock(TEMPLATES_FILE, async () => {
    const templates = await fs.readJson(TEMPLATES_FILE)
    const result = await fn(templates)
    await writeJsonAtomic(TEMPLATES_FILE, templates, { spaces: 2 })
    return result
  })
}

// ── Share Tokens ─────────────────────────────────────────────────────────────
async function readShareTokens() {
  return withFileLock(SHARE_FILE, async () => fs.readJson(SHARE_FILE))
}

async function writeShareTokens(data) {
  return withFileLock(SHARE_FILE, async () => writeJsonAtomic(SHARE_FILE, data, { spaces: 2 }))
}

async function withShareTokens(fn) {
  return withFileLock(SHARE_FILE, async () => {
    const tokens = await fs.readJson(SHARE_FILE)
    const result = await fn(tokens)
    await writeJsonAtomic(SHARE_FILE, tokens, { spaces: 2 })
    return result
  })
}

// ── GitHub Config ────────────────────────────────────────────────────────────
async function readGithubConfig() {
  return withFileLock(GITHUB_CONFIG_FILE, async () => fs.readJson(GITHUB_CONFIG_FILE))
}

async function writeGithubConfig(data) {
  return withFileLock(GITHUB_CONFIG_FILE, async () =>
    writeJsonAtomic(GITHUB_CONFIG_FILE, data, { spaces: 2 })
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────
async function readSettings() {
  return withFileLock(SETTINGS_FILE, async () => normalizeSettings(await fs.readJson(SETTINGS_FILE)))
}

async function writeSettings(data) {
  return withFileLock(SETTINGS_FILE, async () => writeJsonAtomic(SETTINGS_FILE, data, { spaces: 2 }))
}

function normalizeSettings(settings) {
  const revision = settings.settingsRevision ?? 0
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid stored settings revision')
  return { ...settings, settingsRevision: revision }
}

async function updateSettings(expectedRevision, update) {
  return withFileLock(SETTINGS_FILE, async () => {
    const current = normalizeSettings(await fs.readJson(SETTINGS_FILE))
    if (current.settingsRevision !== expectedRevision) {
      throw Object.assign(new Error('Settings changed; reload or resolve the conflict'), { status: 412 })
    }
    if (current.settingsRevision === Number.MAX_SAFE_INTEGER) throw new Error('Settings revision exhausted')
    const updated = { ...await update(current), settingsRevision: current.settingsRevision + 1 }
    await writeJsonAtomic(SETTINGS_FILE, updated, { spaces: 2 })
    return updated
  })
}

// ── Analytics ────────────────────────────────────────────────────────────────
async function readAnalytics() {
  return withFileLock(ANALYTICS_FILE, async () => fs.readJson(ANALYTICS_FILE))
}

async function writeAnalytics(data) {
  return withFileLock(ANALYTICS_FILE, async () => writeJsonAtomic(ANALYTICS_FILE, data, { spaces: 2 }))
}

async function withAnalytics(fn) {
  return withFileLock(ANALYTICS_FILE, async () => {
    const analytics = await fs.readJson(ANALYTICS_FILE)
    const result = await fn(analytics)
    await writeJsonAtomic(ANALYTICS_FILE, analytics, { spaces: 2 })
    return result
  })
}

// ── Media DB ─────────────────────────────────────────────────────────────────
async function readMediaDb() {
  return withFileLock(MEDIA_DB_FILE, async () => fs.readJson(MEDIA_DB_FILE))
}

async function writeMediaDb(data) {
  return withFileLock(MEDIA_DB_FILE, async () => writeJsonAtomic(MEDIA_DB_FILE, data, { spaces: 2 }))
}

async function withMediaDb(fn) {
  return withFileLock(MEDIA_DB_FILE, async () => {
    const mediaDb = await fs.readJson(MEDIA_DB_FILE)
    const result = await fn(mediaDb)
    await writeJsonAtomic(MEDIA_DB_FILE, mediaDb, { spaces: 2 })
    return result
  })
}

// ── Upload Hash Index (SHA-256 dedup) ────────────────────────────────────────
// Single canonical writer for upload-hashes.json. Both the upload route and the
// presentation media-orphan sweep go through this so the index has one atomic
// read-modify-write path instead of two drift-prone copies.
async function withUploadHashes(fn, { signal } = {}) {
  return withFileLock(UPLOAD_HASHES_FILE, async () => {
    signal?.throwIfAborted()
    let hashes
    try {
      hashes = await fs.readJson(UPLOAD_HASHES_FILE)
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err
      hashes = {}
    }
    signal?.throwIfAborted()
    if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) {
      throw new TypeError('Upload hash ledger must be an object')
    }
    const result = await fn(hashes)
    signal?.throwIfAborted()
    await fs.ensureDir(path.dirname(UPLOAD_HASHES_FILE))
    signal?.throwIfAborted()
    await writeJsonAtomic(UPLOAD_HASHES_FILE, hashes, { spaces: 2, signal })
    return result
  })
}

module.exports = {
  // Paths
  DATA_DIR,
  UPLOADS_DIR,
  SHARE_FILE,
  TEMPLATES_FILE,
  HISTORY_DIR,
  GITHUB_CONFIG_FILE,
  RCLONE_CONFIG_FILE,
  SYNC_DIR,
  SETTINGS_FILE,
  ANALYTICS_FILE,
  MEDIA_DB_FILE,
  UPLOAD_HASHES_FILE,

  // Init
  initDataFiles,
  isSecretBearingPath,

  // Lock
  withFileLock,

  // CRUD helpers
  readPresentations,
  writePresentations,
  withPresentations,
  readTemplates,
  writeTemplates,
  withTemplates,
  readShareTokens,
  writeShareTokens,
  withShareTokens,
  readGithubConfig,
  writeGithubConfig,
  readSettings,
  writeSettings,
  updateSettings,
  readAnalytics,
  writeAnalytics,
  withAnalytics,
  readMediaDb,
  writeMediaDb,
  withMediaDb,
  withUploadHashes,
}
