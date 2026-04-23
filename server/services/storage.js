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

// ── Initialize data files ────────────────────────────────────────────────────
function initDataFiles() {
  fs.ensureDirSync(DATA_DIR)
  fs.ensureDirSync(UPLOADS_DIR)
  fs.ensureDirSync(HISTORY_DIR)

  if (!fs.existsSync(DATA_FILE)) fs.writeJsonSync(DATA_FILE, [])
  if (!fs.existsSync(SHARE_FILE)) fs.writeJsonSync(SHARE_FILE, {})
  if (!fs.existsSync(TEMPLATES_FILE)) fs.writeJsonSync(TEMPLATES_FILE, [])
  if (!fs.existsSync(GITHUB_CONFIG_FILE)) {
    fs.writeJsonSync(GITHUB_CONFIG_FILE, { token: '', owner: '', repo: '' })
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeJsonSync(SETTINGS_FILE, {
      aiApiKey: '',
      defaultTheme: 'black',
      defaultTransition: 'slide',
    })
  }
}

// ── Presentations ────────────────────────────────────────────────────────────
async function readPresentations() {
  return withFileLock(DATA_FILE, async () => {
    return fs.readJson(DATA_FILE)
  })
}

async function writePresentations(data) {
  return withFileLock(DATA_FILE, async () => fs.writeJson(DATA_FILE, data, { spaces: 2 }))
}

async function withPresentations(fn) {
  return withFileLock(DATA_FILE, async () => {
    const presentations = await fs.readJson(DATA_FILE)
    const result = await fn(presentations)
    await fs.writeJson(DATA_FILE, presentations, { spaces: 2 })
    return result
  })
}

// ── Templates ────────────────────────────────────────────────────────────────
async function readTemplates() {
  return withFileLock(TEMPLATES_FILE, async () => fs.readJson(TEMPLATES_FILE))
}

async function writeTemplates(data) {
  return withFileLock(TEMPLATES_FILE, async () => fs.writeJson(TEMPLATES_FILE, data, { spaces: 2 }))
}

// ── Share Tokens ─────────────────────────────────────────────────────────────
async function readShareTokens() {
  return withFileLock(SHARE_FILE, async () => fs.readJson(SHARE_FILE))
}

async function writeShareTokens(data) {
  return withFileLock(SHARE_FILE, async () => fs.writeJson(SHARE_FILE, data, { spaces: 2 }))
}

// ── GitHub Config ────────────────────────────────────────────────────────────
async function readGithubConfig() {
  return withFileLock(GITHUB_CONFIG_FILE, async () => fs.readJson(GITHUB_CONFIG_FILE))
}

async function writeGithubConfig(data) {
  return withFileLock(GITHUB_CONFIG_FILE, async () =>
    fs.writeJson(GITHUB_CONFIG_FILE, data, { spaces: 2 })
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────
async function readSettings() {
  return withFileLock(SETTINGS_FILE, async () => fs.readJson(SETTINGS_FILE))
}

async function writeSettings(data) {
  return withFileLock(SETTINGS_FILE, async () => fs.writeJson(SETTINGS_FILE, data, { spaces: 2 }))
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

  // Init
  initDataFiles,

  // Lock
  withFileLock,

  // CRUD helpers
  readPresentations,
  writePresentations,
  withPresentations,
  readTemplates,
  writeTemplates,
  readShareTokens,
  writeShareTokens,
  readGithubConfig,
  writeGithubConfig,
  readSettings,
  writeSettings,
}
