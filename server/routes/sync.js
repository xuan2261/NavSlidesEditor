const crypto = require('node:crypto')
const express = require('express')
const fs = require('fs-extra')
const path = require('path')
const { execFile } = require('child_process')
const { generateRevealHTML } = require('revealjs-shared')
const { normalizePptxImportedPresentationForRead } = require('../services/presentation-normalization')

let execFileImpl = execFile
const {
  readPresentations,
  RCLONE_CONFIG_FILE,
  SYNC_DIR,
  UPLOADS_DIR,
} = require('../services/storage')
const { readAuthoritativePresentations } = require('../services/package-backed-presentation-read')
const { withPackageStore } = require('../services/pptx-import/package-store-runtime')
const { toExternalPresentationDto } = require('../services/pptx-import/package-store/dto')
const { hashRecord } = require('../services/pptx-import/package-store/schemas')

const router = express.Router()
const syncRemoteTails = new Map()
const MAX_SYNC_FOLDER_NAME_LENGTH = 96
const MAX_VISIBLE_PRESENTATION_ID_LENGTH = 24
const PRESENTATION_ID_FINGERPRINT_LENGTH = 16

async function withSyncDestinationLock(destination, action) {
  const remoteName = destination.slice(0, destination.indexOf(':')) || destination
  const previous = syncRemoteTails.get(remoteName) || Promise.resolve()
  let release
  const current = new Promise((resolve) => { release = resolve })
  syncRemoteTails.set(remoteName, current)
  await previous
  try {
    return await action()
  } finally {
    release()
    if (syncRemoteTails.get(remoteName) === current) {
      syncRemoteTails.delete(remoteName)
    }
  }
}

function createSyncWorkspace() {
  fs.ensureDirSync(SYNC_DIR)
  return fs.mkdtempSync(path.join(SYNC_DIR, 'request-'))
}

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

// Validate remote path: reject traversal before canonicalization, max 512 chars
function validateRemotePath(pathValue) {
  if (pathValue === undefined || pathValue === null) return '/slides-backup'
  if (typeof pathValue !== 'string') return null
  const sanitized = pathValue.replace(/[\r\n]/g, '').trim()
  if (!sanitized) return '/slides-backup'
  if (sanitized.length > 512 || sanitized.includes('\0')) return null

  const slashPath = sanitized.replace(/\\/g, '/')
  if (slashPath.split('/').some((segment) => segment === '..')) return null

  const normalized = path.posix.normalize(slashPath.startsWith('/') ? slashPath : `/${slashPath}`)
  if (normalized === '/') return null
  let canonical = normalized
  while (canonical.length > 1 && canonical.endsWith('/')) canonical = canonical.slice(0, -1)
  return canonical || '/slides-backup'
}

function sanitizeFolderSegment(value, fallback) {
  const sanitized = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return sanitized || fallback
}

function presentationFolderName(presentation, occupiedNames = new Set()) {
  const rawId = presentation?.id === undefined || presentation?.id === null
    ? ''
    : String(presentation.id)
  const identity = rawId ? `id:${rawId}` : 'missing-presentation-id'
  const visibleId = sanitizeFolderSegment(rawId, 'presentation')
    .slice(0, MAX_VISIBLE_PRESENTATION_ID_LENGTH)
  const fingerprint = crypto.createHash('sha256')
    .update(identity, 'utf8')
    .digest('hex')
    .slice(0, PRESENTATION_ID_FINGERPRINT_LENGTH)
  const suffix = `-${visibleId}-${fingerprint}`
  const titleLength = Math.max(1, MAX_SYNC_FOLDER_NAME_LENGTH - suffix.length)
  const baseName = `${sanitizeFolderSegment(presentation?.title, 'untitled').slice(0, titleLength)}${suffix}`

  let folderName = baseName
  let collision = 2
  while (occupiedNames.has(folderName)) {
    const collisionSuffix = `-${collision}`
    folderName = `${baseName.slice(0, MAX_SYNC_FOLDER_NAME_LENGTH - collisionSuffix.length)}${collisionSuffix}`
    collision += 1
  }
  occupiedNames.add(folderName)
  return folderName
}

function getUploadFilenameFromUrl(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/\/uploads\/([^?#]+)/)
  return match ? path.basename(decodeURIComponent(match[1])) : null
}

function collectUploadRefs(presentations) {
  const refs = new Set()
  const visit = (value) => {
    if (typeof value === 'string') {
      const direct = getUploadFilenameFromUrl(value)
      if (direct) refs.add(direct)
      const matches = value.matchAll(/\/uploads\/([^?#"'\s<>]+)/g)
      for (const match of matches) {
        try {
          const filename = path.basename(decodeURIComponent(match[1]))
          if (filename) refs.add(filename)
        } catch {}
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(visit)
    }
  }
  presentations.forEach(visit)
  return refs
}

function copyUploadRefs(refs, destination) {
  fs.ensureDirSync(destination)
  for (const filename of refs) {
    const source = path.join(UPLOADS_DIR, filename)
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(destination, filename))
  }
}

async function exportPackageBundle(store, resolved) {
  if (resolved.generation === null) return null
  const expectedHead = resolved.presentation.pptxAggregateHead
  const bundle = await store.exportPresentationPackage(
    resolved.presentation.id,
    { expectedHead }
  )
  if (!bundle) {
    throw Object.assign(new Error('Package export is unavailable'), {
      code: 'PACKAGE_EXPORT_UNAVAILABLE',
      status: 422,
    })
  }
  if (expectedHead && hashRecord(bundle.manifest.head) !== hashRecord(expectedHead)) {
    throw Object.assign(new Error('Presentation changed during sync; retry'), {
      code: 'SYNC_SOURCE_CHANGED',
      status: 409,
      retryable: true,
    })
  }
  return bundle
}

function writePackageBundle(folder, bundle) {
  const packageDir = path.join(folder, 'package')
  const blobsDir = path.join(packageDir, 'blobs')
  fs.ensureDirSync(blobsDir)
  fs.writeFileSync(path.join(packageDir, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2))
  for (const blob of bundle.blobs || []) {
    fs.writeFileSync(path.join(blobsDir, `${blob.sha256}.pptx`), blob.bytes)
  }
}

function presentationNotFoundError() {
  return Object.assign(new Error('Presentation not found'), { status: 404 })
}

function addUploadRefs(target, presentation) {
  for (const filename of collectUploadRefs([presentation])) target.add(filename)
}

async function prepareBulkWorkspace(workspace) {
  const prepared = await withPackageStore(async (store) => {
    const presentations = await readPresentations()
    const authoritativePresentations = await readAuthoritativePresentations(presentations)
    const occupiedFolders = new Set()
    const uploadRefs = new Set()

    for (const resolved of authoritativePresentations) {
      const presentation = toExternalPresentationDto(
        normalizePptxImportedPresentationForRead(resolved.presentation)
      )
      const folder = path.join(workspace, presentationFolderName(presentation, occupiedFolders))
      const bundle = await exportPackageBundle(store, resolved)

      fs.ensureDirSync(folder)
      fs.writeFileSync(path.join(folder, 'presentation.html'), generateRevealHTML(presentation))
      fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(presentation, null, 2))
      if (bundle) writePackageBundle(folder, bundle)
      addUploadRefs(uploadRefs, presentation)
    }

    return { synced: authoritativePresentations.length, uploadRefs }
  })

  if (fs.existsSync(UPLOADS_DIR)) {
    copyUploadRefs(prepared.uploadRefs, path.join(workspace, '_uploads'))
  }
  return prepared.synced
}

async function prepareSingleWorkspace(workspace, presentationId) {
  const prepared = await withPackageStore(async (store) => {
    const presentations = await readPresentations()
    const storedPresentation = presentations.find((presentation) => presentation.id === presentationId)
    if (!storedPresentation) throw presentationNotFoundError()

    const [resolved] = await readAuthoritativePresentations([storedPresentation])
    if (!resolved) throw presentationNotFoundError()

    const presentation = toExternalPresentationDto(
      normalizePptxImportedPresentationForRead(resolved.presentation)
    )
    const folderName = presentationFolderName(presentation)
    const folder = path.join(workspace, folderName)
    const bundle = await exportPackageBundle(store, resolved)

    fs.ensureDirSync(folder)
    fs.writeFileSync(path.join(folder, 'presentation.html'), generateRevealHTML(presentation))
    fs.writeFileSync(path.join(folder, 'presentation.json'), JSON.stringify(presentation, null, 2))
    if (bundle) writePackageBundle(folder, bundle)

    return {
      folderName,
      uploadRefs: collectUploadRefs([presentation]),
    }
  })

  if (fs.existsSync(UPLOADS_DIR)) {
    copyUploadRefs(prepared.uploadRefs, path.join(workspace, prepared.folderName, '_uploads'))
  }
  return prepared.folderName
}

function runRclone(args, env = {}) {
  return new Promise((resolve, reject) => {
    const mergedEnv = { ...process.env, RCLONE_CONFIG: RCLONE_CONFIG_FILE, ...env }
    execFileImpl('rclone', args, { env: mergedEnv, timeout: 120000 }, (err, stdout, stderr) => {
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
    if (!dest) return res.status(400).json({ error: 'Invalid remote path' })
    const remoteDest = `${safeRemote}:${dest}`

    const result = await withSyncDestinationLock(remoteDest, async () => {
      const workspace = createSyncWorkspace()
      try {
        const synced = await prepareBulkWorkspace(workspace)
        await runRclone(['sync', workspace, remoteDest, '--progress'])
        return { synced }
      } finally {
        try { fs.removeSync(workspace) } catch {}
      }
    })
    res.json({ success: true, synced: result.synced, destination: remoteDest })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code })
  }
})

// POST /api/rclone/sync-single
router.post('/sync-single', async (req, res) => {
  try {
    const { remote, remotePath, presentationId } = req.body
    const safeRemote = validateRemoteName(remote)
    if (!safeRemote || !presentationId) {
      return res.status(400).json({ error: 'Remote and presentationId required' })
    }
    const dest = validateRemotePath(remotePath)
    if (!dest) return res.status(400).json({ error: 'Invalid remote path' })
    const remoteBase = `${safeRemote}:${dest}`

    const remoteDest = await withSyncDestinationLock(remoteBase, async () => {
      const workspace = createSyncWorkspace()
      try {
        const folderName = await prepareSingleWorkspace(workspace, presentationId)
        const destination = remoteBase.endsWith('/')
          ? `${remoteBase}${folderName}`
          : `${remoteBase}/${folderName}`
        await runRclone(['sync', path.join(workspace, folderName), destination])
        return destination
      } finally {
        try { fs.removeSync(workspace) } catch {}
      }
    })
    res.json({ success: true, destination: remoteDest })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, code: err.code })
  }
})

router.setRcloneExecutor = (executor) => {
  if (typeof executor !== 'function') throw new TypeError('Rclone executor must be a function')
  execFileImpl = executor
}
router.resetRcloneExecutor = () => {
  execFileImpl = execFile
}

module.exports = router
