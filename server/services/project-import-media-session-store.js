const path = require('node:path')
const fs = require('fs-extra')
const { DATA_DIR, withFileLock } = require('./storage')

const SESSION_FILE = path.join(DATA_DIR, 'project-import-sessions.json')
let counter = 0

async function readAllUnlocked() {
  try {
    const value = await fs.readJson(SESSION_FILE)
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

async function writeAllUnlocked(value) {
  await fs.ensureDir(path.dirname(SESSION_FILE))
  const candidate = `${SESSION_FILE}.tmp.${process.pid}.${++counter}`
  await fs.writeJson(candidate, value, { spaces: 2, mode: 0o600 })
  await fs.rename(candidate, SESSION_FILE)
  if (process.platform !== 'win32') await fs.chmod(SESSION_FILE, 0o600)
}

async function readSession(sessionId) {
  return withFileLock(SESSION_FILE, async () => {
    const sessions = await readAllUnlocked()
    return sessions[sessionId] ? structuredClone(sessions[sessionId]) : null
  })
}

async function updateSession(sessionId, action) {
  return withFileLock(SESSION_FILE, async () => {
    const sessions = await readAllUnlocked()
    const current = sessions[sessionId] || null
    const result = await action(current ? structuredClone(current) : null)
    if (result?.record) sessions[sessionId] = result.record
    else if (result?.remove) delete sessions[sessionId]
    await writeAllUnlocked(sessions)
    return result?.value
  })
}

async function listSessions() {
  return withFileLock(SESSION_FILE, async () => Object.values(await readAllUnlocked()))
}

module.exports = { SESSION_FILE, listSessions, readSession, updateSession }
