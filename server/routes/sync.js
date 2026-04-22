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

const router = express.Router()

function runRclone(args, env = {}) {
  return new Promise((resolve, reject) => {
    const mergedEnv = { ...process.env, RCLONE_CONFIG: RCLONE_CONFIG_FILE, ...env }
    execFile('rclone', args, { env: mergedEnv, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
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
    const name = remoteName || 'protondrive'

    // Security: obscure password using rclone itself (prevents plaintext on disk)
    let obscuredPassword = password
    try {
      obscuredPassword = await runRclone(['obscure', password])
    } catch {
      // Fallback: store as-is if rclone obscure fails (rclone may not be installed)
    }

    const configContent = `[${name}]\ntype = protondrive\nusername = ${username}\npassword = ${obscuredPassword}\n`
    await fs.writeFile(RCLONE_CONFIG_FILE, configContent)
    try {
      await runRclone(['lsd', `${name}:`])
    } catch (err) {
      return res.status(400).json({ error: 'Connection failed: ' + err.message })
    }
    res.json({ success: true, remote: name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/rclone/sync
router.post('/sync', async (req, res) => {
  try {
    const { remote, remotePath } = req.body
    if (!remote) return res.status(400).json({ error: 'Remote name required' })
    const dest = remotePath || '/slides-backup'

    fs.ensureDirSync(SYNC_DIR)
    fs.emptyDirSync(SYNC_DIR)

    const presentations = await readPresentations()
    for (const pres of presentations) {
      const folderName = (pres.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
      const folder = path.join(SYNC_DIR, folderName)
      fs.ensureDirSync(folder)
      fs.writeFileSync(path.join(folder, 'presentation.html'), generateRevealHTML(pres))
      fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(pres, null, 2))
    }

    const uploadsSync = path.join(SYNC_DIR, '_uploads')
    if (fs.existsSync(UPLOADS_DIR)) fs.copySync(UPLOADS_DIR, uploadsSync)

    const remoteDest = `${remote}:${dest}`
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
    if (!remote || !presentationId)
      return res.status(400).json({ error: 'Remote and presentationId required' })
    const dest = remotePath || '/slides-backup'

    const presentations = await readPresentations()
    const pres = presentations.find((p) => p.id === presentationId)
    if (!pres) return res.status(404).json({ error: 'Presentation not found' })

    fs.ensureDirSync(SYNC_DIR)
    const folderName = (pres.title || 'untitled').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    const folder = path.join(SYNC_DIR, folderName)
    fs.ensureDirSync(folder)

    fs.writeFileSync(path.join(folder, 'presentation.html'), generateRevealHTML(pres))
    fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(pres, null, 2))

    const remoteDest = `${remote}:${dest}/${folderName}`
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
