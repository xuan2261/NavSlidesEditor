const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs-extra')
const http = require('http')
const { Server } = require('socket.io')
const bcrypt = require('bcryptjs')
const rateLimit = require('express-rate-limit')
const {
  initDataFiles,
  UPLOADS_DIR,
  readShareTokens,
  withShareTokens,
  DATA_DIR,
} = require('./services/storage')
const { errorHandler } = require('./middleware/error-handler')
const { createLocalMutationIngressPolicy } = require('./middleware/local-mutation-ingress')
const { generateRevealHTML } = require('revealjs-shared')
const { readAuthoritativePresentation } = require('./services/package-backed-presentation-read')
const { recordView } = require('./routes/analytics')
const { setupSocketHandlers } = require('./services/socket-handler')
const { setupGameSocketHandlers } = require('./services/game-socket-handler')
const {
  initializePackageStore,
  shutdownPackageStore,
} = require('./services/pptx-import/package-store-runtime')
const { stripControlChars } = require('./utils/strip-control-chars')
const { resolveListenHost, getExposureWarning } = require('./services/listen-host-policy')
const { sanitizeSvgBuffer } = require('./services/svg-upload-sanitizer')

/**
 * A store that fails to release is exactly what leaves the writer lock held and
 * blocks the next boot, so it must never fail silently. Log and continue: a noisy
 * shutdown must not turn an otherwise healthy stop into a non-zero exit.
 */
function logStoreReleaseFailure(error) {
  console.error(
    '[shutdown] package store release failed:',
    stripControlChars(error?.message || error).trim()
  )
}

const serverShutdownPromises = new WeakMap()
let packageStoreShutdownPromise = null

function releasePackageStore() {
  if (!packageStoreShutdownPromise) {
    packageStoreShutdownPromise = shutdownPackageStore().catch(logStoreReleaseFailure)
  }
  return packageStoreShutdownPromise
}

function drainServerTransports(server, timeoutMs) {
  if (!server) return Promise.resolve()
  const io = server.navslidesIo
  return new Promise((resolve) => {
    let pending = 0
    let settled = false
    const finish = () => {
      if (settled) return
      try {
        io?.engine?.close()
      } catch {
        // Transport is already closed or being force-closed.
      }
      settled = true
      clearTimeout(timeout)
      resolve()
    }
    const completeOne = () => {
      pending -= 1
      if (pending === 0) finish()
    }
    const timeout = setTimeout(() => {
      server.getConnections?.((_error, count) => {
        console.warn(`[shutdown] drain deadline exceeded; force-closing ${count} connection(s)`)
      })
      io?.disconnectSockets?.(true)
      server.closeAllConnections?.()
      finish()
    }, timeoutMs)
    timeout.unref?.()

    if (io) {
      try {
        io.disconnectSockets(true)
      } catch {
        // HTTP drain still owns the bounded shutdown contract.
      }
    }

    if (server.listening) {
      pending += 1
      try {
        server.close(completeOne)
      } catch {
        completeOne()
      }
    }

    if (pending === 0) finish()
  })
}

// ── Routes ───────────────────────────────────────────────────────────────────
const presentationsRouter = require('./routes/presentations')
const templatesRouter = require('./routes/templates')
const shareRouter = require('./routes/share')
const uploadRouter = require('./routes/upload')
const githubRouter = require('./routes/github')
const syncRouter = require('./routes/sync')
const historyRouter = require('./routes/history')
const settingsRouter = require('./routes/settings')
const mediaRouter = require('./routes/media')
const liveRouter = require('./routes/live')
const pptxImportRouter = require('./routes/pptx-import')
const gamesRouter = require('./routes/games-rest-api-handler')
const pluginsRouter = require('./routes/plugins')

// ── App setup ────────────────────────────────────────────────────────────────
const app = express()
const PORT = process.env.PORT || 3002

// Initialize data directories and files
initDataFiles()

// ── Security: UUID validation for :id and :snapshotId params ─────────────────
function isValidId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)
}

app.param('id', (req, res, next, val) => {
  if (!isValidId(val)) return res.status(400).json({ error: 'Invalid ID format' })
  next()
})
app.param('snapshotId', (req, res, next, val) => {
  if (!isValidId(val)) return res.status(400).json({ error: 'Invalid snapshot ID format' })
  next()
})
app.param('presId', (req, res, next, val) => {
  if (!isValidId(val)) return res.status(400).json({ error: 'Invalid ID format' })
  next()
})
app.param('jobId', (req, res, next, jobId) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
    return res.status(400).json({ error: 'Invalid jobId' })
  }
  next()
})

// ── Middleware ────────────────────────────────────────────────────────────────
const corsOptions = process.env.NODE_ENV === 'production' ? { origin: false } : { origin: true }
app.use(cors(corsOptions))
// Local deployment and CSRF boundary, not multi-user authentication. This runs
// before body parsing, upload handling, rate-limit accounting, and every route.
app.use(createLocalMutationIngressPolicy())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: false }))

// ── Rate limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 200000,
  message: { error: 'Too many requests, please try again later' },
})
app.use('/api/', apiLimiter)

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 300,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many uploads, please try again later' },
})
app.use('/api/upload', uploadLimiter)

const shareLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  message: 'Too many attempts. Try again later.',
})
app.use('/share/', shareLimiter)

const socketIoClientDist = path.join(__dirname, '..', 'node_modules', 'socket.io-client', 'dist')
// Uploaded SVG is untrusted as a navigable document, including legacy files.
app.use('/uploads', async (req, res, next) => {
  if (path.extname(req.path).toLowerCase() !== '.svg') return next()
  let requestedPath
  try {
    requestedPath = decodeURIComponent(req.path)
  } catch {
    return res.status(400).json({ error: 'Invalid upload path' })
  }
  const uploadsRoot = path.resolve(UPLOADS_DIR)
  const filePath = path.resolve(uploadsRoot, requestedPath.replace(/^[/\\]+/, ''))
  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return res.status(400).json({ error: 'Invalid upload path' })
  }
  try {
    const sanitized = sanitizeSvgBuffer(await fs.readFile(filePath))
    res.set({
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    })
    return res.send(sanitized)
  } catch (error) {
    if (error?.code === 'ENOENT') return next()
    return res.status(404).json({ error: 'SVG is unavailable' })
  }
})
app.use('/uploads', express.static(UPLOADS_DIR))
if (fs.existsSync(socketIoClientDist)) {
  app.use('/vendor/socket.io', express.static(socketIoClientDist))
}
app.use('/vendor', express.static(path.join(__dirname, 'vendor')))

// ── Mount routes ─────────────────────────────────────────────────────────────
// Core CRUD — order matters: more specific paths before generic ones
app.use('/api/presentations', shareRouter) // /:id/share
app.use('/api/presentations', historyRouter) // /:id/snapshot(s), /:id/restore
app.use('/api/presentations', presentationsRouter) // CRUD + export + present + duplicate + save-as-template
app.use('/api/templates', templatesRouter)
app.use('/api/upload', uploadRouter)
app.post('/api/pptx/import', uploadLimiter)
app.use('/api/pptx', pptxImportRouter)
app.use('/api/github', githubRouter)
app.use('/api/rclone', syncRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/media', mediaRouter)
app.use('/api/live', liveRouter)
app.use('/api/games', gamesRouter)
app.use('/api/plugins', pluginsRouter)
app.use('/api/explore', require('./routes/explore'))
app.use('/api/ai', require('./routes/ai'))
app.use('/api/marketplace', require('./routes/marketplace'))
app.use('/api/analytics', require('./routes/analytics'))

// Single-token DELETE
app.delete('/api/shares/:token', async (req, res) => {
  try {
    // Atomic RMW (I-R5.1): existence check + delete under one lock.
    const existed = await withShareTokens((tokens) => {
      if (!tokens[req.params.token]) return false
      delete tokens[req.params.token]
      return true
    })
    if (!existed) return res.status(404).json({ error: 'Token not found' })
    res.json({ deleted: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GitHub push — bridge from /api/presentations/:id/github/push to github router
app.post('/api/presentations/:id/github/push', (req, res, next) => {
  req.params.presId = req.params.id
  req.url = `/push/${req.params.id}`
  githubRouter(req, res, next)
})

// bcrypt moved to top-level imports

// Helper for presentation viewer HTML payload (with server-side XSS sanitization)
async function renderShareView(presentationId, res) {
  // Serve-guard (C2): a soft-deleted deck must not render even via a live share
  // token. The authoritative reader returns null for missing or trashed decks.
  const resolved = await readAuthoritativePresentation(presentationId)
  if (!resolved) return res.status(404).send('Presentation not found')

  // Keep html embeds trusted and programmable in share mode too.
  // We only normalize customCSS risky URL/expression patterns.
  const sanitized = JSON.parse(JSON.stringify(resolved.presentation))
  // Sanitize customCSS to prevent expression() / javascript: injection
  if (sanitized.customCSS) {
    sanitized.customCSS = sanitized.customCSS
      .replace(/expression\s*\(/gi, '/* blocked */(')
      .replace(/javascript\s*:/gi, '/* blocked */:')
      .replace(/url\s*\(\s*['"]?\s*javascript/gi, 'url(/* blocked */')
  }

  const html = generateRevealHTML(sanitized)
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.send(html)
}

// Analytics and Expiry handler
function canViewShare(tokenData) {
  if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
    return false
  }
  return true
}

async function incrementShareViews(token) {
  return withShareTokens((tokens) => {
    let tokenData = tokens[token]
    if (!tokenData) return null
    if (typeof tokenData === 'string') {
      tokenData = { presentationId: tokenData, views: 0 }
    }
    tokenData.views = (tokenData.views || 0) + 1
    tokens[token] = tokenData
    return tokenData
  })
}

// Verify password for protected link
app.post('/share/:token/verify', async (req, res) => {
  try {
    const tokens = await readShareTokens()
    let tokenData = tokens[req.params.token]

    // Normalize if legacy string
    if (typeof tokenData === 'string') tokenData = { presentationId: tokenData }
    if (!tokenData) return res.status(404).json({ error: 'Token not found' })
    if (!canViewShare(tokenData)) return res.status(403).json({ error: 'Link expired' })

    if (tokenData.password) {
      if (!req.body.password) return res.status(401).json({ error: 'Password required' })
      const isValid = await bcrypt.compare(req.body.password, tokenData.password)
      if (!isValid) return res.status(401).json({ error: 'Invalid password' })
    }

    res.json({ verified: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Share public view at /share/:token
// GET: show password form if protected, otherwise render presentation
app.get('/share/:token', async (req, res) => {
  try {
    const tokens = await readShareTokens()
    let tokenData = tokens[req.params.token]

    // Normalize if legacy string
    if (typeof tokenData === 'string') {
      tokenData = { presentationId: tokenData, views: 0 }
    }

    if (!tokenData) return res.status(404).send('Presentation not found or sharing disabled')
    if (!canViewShare(tokenData)) return res.status(403).send('This link has expired')

    // Security: password protected links show POST form (no password in URL)
    if (tokenData.password) {
      return res.send(`
        <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;background:#1e1e2e;margin:0;">
          <form method="POST" style="text-align:center;color:#e0e0e0;">
            <h2 style="margin-bottom:20px;">Password Required</h2>
            <input type="password" name="pwd" placeholder="Enter password"
                   style="padding:8px 12px;border-radius:6px;border:1px solid #3a3a4e;background:#2a2a3e;color:#e0e0e0;font-size:14px;" />
            <button type="submit" style="padding:8px 18px;background:#6366f1;color:white;border:none;border-radius:6px;margin-left:8px;cursor:pointer;font-size:14px;">
              View
            </button>
          </form>
        </body></html>
      `)
    }

    // Increment views safely
    const updatedTokenData = await incrementShareViews(req.params.token)
    if (!updatedTokenData) return res.status(404).send('Presentation not found or sharing disabled')

    // Record analytics
    try {
      await recordView(updatedTokenData.presentationId, req.params.token, req.get('referer') || '')
    } catch {}

    await renderShareView(updatedTokenData.presentationId, res)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /share/:token — password verification via form body (not URL query)
app.post('/share/:token', async (req, res) => {
  try {
    const tokens = await readShareTokens()
    let tokenData = tokens[req.params.token]
    if (typeof tokenData === 'string') tokenData = { presentationId: tokenData }
    if (!tokenData) return res.status(404).send('Not found')
    if (!canViewShare(tokenData)) return res.status(403).send('This link has expired')

    // Token has no stored password: nothing to verify against. Bounce back to the
    // GET handler, which renders the deck directly (avoids bcrypt.compare on undefined → 500).
    if (!tokenData.password) {
      return res.redirect(`/share/${req.params.token}`)
    }

    const pwd = req.body?.pwd
    if (!pwd || !(await bcrypt.compare(pwd, tokenData.password))) {
      return res.redirect(`/share/${req.params.token}`) // back to form
    }

    // Increment views safely
    const updatedTokenData = await incrementShareViews(req.params.token)
    if (!updatedTokenData) return res.status(404).send('Not found')

    // Record analytics
    try {
      await recordView(updatedTokenData.presentationId, req.params.token, req.get('referer') || '')
    } catch {}

    await renderShareView(updatedTokenData.presentationId, res)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── SPA fallback (production) ────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  let clientDist = path.join(__dirname, '..', 'client', 'dist')
  if (!fs.existsSync(clientDist) && process.resourcesPath) {
    clientDist = path.join(process.resourcesPath, 'client', 'dist')
  }
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist))
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }
}

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler)

// ── Server start ─────────────────────────────────────────────────────────────
async function startServer(port, options = {}) {
  const p = port ?? PORT
  const listenHost = resolveListenHost({
    explicitHost: options.host,
    envHost: process.env.NAVSLIDES_LISTEN_HOST,
  })
  const exposureWarning = getExposureWarning(listenHost)
  if (exposureWarning) console.warn(JSON.stringify(exposureWarning))
  await initializePackageStore({ rootDir: path.resolve(DATA_DIR) })
  packageStoreShutdownPromise = null
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.once('close', () => {
      if (!serverShutdownPromises.has(server)) releasePackageStore()
    })
    server.once('error', async (error) => {
      await releasePackageStore()
      reject(error)
    })

    const corsOptions = process.env.NODE_ENV === 'production' ? { origin: false } : { origin: '*' }
    const io = new Server(server, { cors: corsOptions, path: '/ws' })
    server.navslidesIo = io
    app.set('io', io)
    setupSocketHandlers(io)
    setupGameSocketHandlers(io)

    server.listen(p, listenHost, () => {
      const address = server.address()
      const actualAddress = typeof address === 'object' && address
        ? `${address.address}:${address.port}`
        : String(address)
      console.log(`Server running on http://${actualAddress}`)
      resolve(server)
    })
  })
}

/**
 * Stop admission, drain HTTP and Socket.IO work, then release the package store.
 * Concurrent callers share one shutdown so the writer lock cannot be released
 * while another caller is still draining transports.
 */
function stopServer(server, options = {}) {
  if (!server) return releasePackageStore()
  const existing = serverShutdownPromises.get(server)
  if (existing) return existing
  const timeoutMs = Number.isFinite(options.drainTimeoutMs)
    ? Math.max(0, options.drainTimeoutMs)
    : 5000
  const shutdown = Promise.resolve()
    .then(() => drainServerTransports(server, timeoutMs))
    .then(() => pptxImportRouter.drainDetachedImportCleanups?.({ timeoutMs }))
    .then(releasePackageStore)
  serverShutdownPromises.set(server, shutdown)
  return shutdown
}

/**
 * Signal shutdown uses the same bounded drain path as Electron and tests.
 */
function installShutdownHandlers(server) {
  let stopping = false
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      if (stopping) return
      stopping = true
      console.log(`Received ${signal}, shutting down`)
      stopServer(server).finally(() => process.exit(0))
    })
  }
  return server
}

if (require.main === module) {
  startServer()
    .then(installShutdownHandlers)
    .catch((error) => {
      console.error('Server failed to start', error)
      process.exitCode = 1
    })
}

module.exports = { app, startServer, stopServer }
