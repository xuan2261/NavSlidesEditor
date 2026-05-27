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
  writeShareTokens,
  withShareTokens,
  readPresentations,
} = require('./services/storage')
const { errorHandler } = require('./middleware/error-handler')
const { generateRevealHTML } = require('revealjs-shared')
const { normalizePptxImportedPresentationForRead } = require('./services/presentation-normalization')
const { recordView } = require('./routes/analytics')
const { setupSocketHandlers } = require('./services/socket-handler')
const { setupGameSocketHandlers } = require('./services/game-socket-handler')

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

// Ensure correct MIME-type for wasm
express.static.mime.define({ 'application/wasm': ['wasm'] })

app.use('/uploads', express.static(UPLOADS_DIR))
const socketIoClientDist = path.join(__dirname, '..', 'node_modules', 'socket.io-client', 'dist')
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
app.use('/api/pptx', uploadLimiter)
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
    const tokens = await readShareTokens()
    if (!tokens[req.params.token]) return res.status(404).json({ error: 'Token not found' })
    delete tokens[req.params.token]
    await writeShareTokens(tokens)
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
  const presentations = await readPresentations()
  const presentation = presentations.find((p) => p.id === presentationId)
  if (!presentation) return res.status(404).send('Presentation not found')

  // Keep html embeds trusted and programmable in share mode too.
  // We only normalize customCSS risky URL/expression patterns.
  const sanitized = JSON.parse(JSON.stringify(normalizePptxImportedPresentationForRead(presentation)))
  // Sanitize customCSS to prevent expression() / javascript: injection
  if (sanitized.customCSS) {
    sanitized.customCSS = sanitized.customCSS
      .replace(/expression\s*\(/gi, '/* blocked */(')
      .replace(/javascript\s*:/gi, '/* blocked */:')
      .replace(/url\s*\(\s*['"]?\s*javascript/gi, 'url(/* blocked */')
  }

  const html = generateRevealHTML(sanitized)
  res.setHeader('Content-Type', 'text/html')
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
function startServer(port) {
  const p = port || PORT
  return new Promise((resolve) => {
    const server = http.createServer(app)

    // Attach Socket.IO
    const corsOptions = process.env.NODE_ENV === 'production' ? { origin: false } : { origin: '*' }
    const io = new Server(server, { cors: corsOptions, path: '/ws' })

    setupSocketHandlers(io)
    setupGameSocketHandlers(io)

    server.listen(p, () => {
      console.log(`Server running on http://localhost:${p}`)
      resolve(server)
    })
  })
}

if (require.main === module) {
  startServer()
}

module.exports = { app, startServer }
