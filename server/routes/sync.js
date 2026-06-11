const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const { execFile } = require('child_process')
const { generateRevealHTML } = require('revealjs-shared')
const {
  readPresentations,
  RCLONE_CONFIG_FILE,
  SYNC_DIR,
  UPLOADS_DIR,
} = require('../services/storage')
const { normalizePptxImportedPresentationForRead } = require('../services/presentation-normalization')

const router = express.Router()

// Validate remote name: alphanumeric + dash + underscore only, max 256 chars
function validateRemoteName(name, required = false) {
  if (!name || typeof name !== 'string') return required ? null : null
  const sanitized = name.trim()
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(sanitized)) return null
  return sanitized
}

// Sanitize string inputs: strip newlines/carriage returns (prevents injection)
function sanitizeInput(value) {
  if (!value || typeof value !== 'string') return ''
  return value.replace(/[\r\n]/g, '').slice(0, 1024)
}

// Validate remote path: disallow path traversal, max 512 chars
function validateRemotePath(pathValue) {
  if (!pathValue || typeof pathValue !== 'string') return '/slides-backup'
  const sanitized = pathValue.replace(/\.\./g, '').trim().slice(0, 512)
  return sanitized.startsWith('/') ? sanitized : '/' + sanitized
}

function runRclone(args, env = {}) {
  return new Promise((resolve, reject) => {
    const mergedEnv = { ...process.env, RCLONE_CONFIG: RCLONE_CONFIG_FILE, ...env }
    execFile('rclone', args, { env: mergedEnv, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        // rclone stderr can echo absolute paths, remote names, and config
        // hints. Log full detail server-side only; surface a generic message
        // so the HTTP client never receives the raw stderr.
        console.error('[rclone]', args[0], stderr || err.message)
        const generic = new Error('rclone command failed')
        generic.rcloneCommand = args[0]
        return reject(generic)
      }
      resolve(stdout.trim())
    })
  })
}

// GET /api/rclone/status
router.get('/status', async (req, res) => {
  try {
    let installed = false
    let version = ''
    try {
      version = await runRclone(['version'])
      installed = true
    } catch {}
    const hasConfig = fs.existsSync(RCLONE_CONFIG_FILE)
    let remotes = []
    if (installed && hasConfig) {
      try {
        const out = await runRclone(['listremotes'])
        remotes = out
          .split('\n')
          .filter(Boolean)
          .map((r) => r.replace(/:$/, ''))
      } catch {}
    }
    res.json({ installed, version: version.split('\n')[0] || '', hasConfig, remotes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rclone/config
router.post('/config', async (req, res) => {
  try {
    const { username, password, remoteName } = req.body
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' })

    const safeName = validateRemoteName(remoteName, false) || 'protondrive'
    const safeUsername = sanitizeInput(username)
    const safePassword = sanitizeInput(password)

    if (!safeUsername) return res.status(400).json({ error: 'Username cannot be empty' })
    if (!safePassword) return res.status(400).json({ error: 'Password cannot be empty' })

    // Security: obscure password using rclone itself (prevents plaintext on disk)
    // Fail hard if rclone obscure is unavailable — no plaintext fallback
    let obscuredPassword
    try {
      obscuredPassword = await runRclone(['obscure', safePassword])
    } catch {
      return res.status(500).json({ error: 'Failed to obscure password. rclone must be installed and functional.' })
    }

    const configContent = `[${safeName}]\ntype = protondrive\nusername = ${safeUsername}\npassword = ${obscuredPassword}\n`
    await fs.writeFile(RCLONE_CONFIG_FILE, configContent)
    try {
      await runRclone(['lsd', `${safeName}:`])
    } catch (err) {
      return res.status(400).json({ error: 'Connection failed: ' + err.message })
    }
    res.json({ success: true, remote: safeName })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rclone/sync
router.post('/sync', async (req, res) => {
  try {
    const { remote, remotePath } = req.body
    const safeRemote = validateRemoteName(remote)
    if (!safeRemote) return res.status(400).json({ error: 'Invalid remote name' })
    const dest = validateRemotePath(remotePath)

    fs.ensureDirSync(SYNC_DIR)
    fs.emptyDirSync(SYNC_DIR)

    const presentations = await readPresentations()
    for (const pres of presentations) {
      const normalized = normalizePptxImportedPresentationForRead(pres)
      const folderName = (normalized.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
      const folder = path.join(SYNC_DIR, folderName)
      fs.ensureDirSync(folder)
      fs.writeFileSync(path.join(folder, 'presentation.html'), generateRevealHTML(normalized))
      fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(normalized, null, 2))
    }

    const uploadsSync = path.join(SYNC_DIR, '_uploads')
    if (fs.existsSync(UPLOADS_DIR)) fs.copySync(UPLOADS_DIR, uploadsSync)

    const remoteDest = `${safeRemote}:${dest}`
    await runRclone(['sync', SYNC_DIR, remoteDest, '--progress'])
    fs.removeSync(SYNC_DIR)
    res.json({ success: true, synced: presentations.length, destination: remoteDest })
  } catch (err) {
    try {
      fs.removeSync(SYNC_DIR)
    } catch {}
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rclone/sync-single
router.post('/sync-single', async (req, res) => {
  try {
    const { remote, remotePath, presentationId } = req.body
    const safeRemote = validateRemoteName(remote)
    if (!safeRemote || !presentationId)
      return res.status(400).json({ error: 'Remote and presentationId required' })
    const dest = validateRemotePath(remotePath)

    const presentations = await readPresentations()
    const pres = presentations.find((p) => p.id === presentationId)
    if (!pres) return res.status(404).json({ error: 'Presentation not found' })
    const normalized = normalizePptxImportedPresentationForRead(pres)

    fs.ensureDirSync(SYNC_DIR)
    const folderName = (normalized.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    const folder = path.join(SYNC_DIR, folderName)
    fs.ensureDirSync(folder)

    fs.writeFileSync(path.join(folder, 'presentation.html'), generateRevealHTML(normalized))
    fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(normalized, null, 2))

    const remoteDest = `${safeRemote}:${dest}/${folderName}`
    await runRclone(['sync', folder, remoteDest])
    fs.removeSync(SYNC_DIR)
    res.json({ success: true, destination: remoteDest })
  } catch (err) {
    try {
      fs.removeSync(SYNC_DIR)
    } catch {}
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
