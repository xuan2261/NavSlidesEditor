const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const { generateRevealHTML, normalizePresentationNotes } = require('revealjs-shared')
const {
  readPresentations,
  withPresentations,
  withShareTokens,
  HISTORY_DIR,
} = require('../services/storage')
const fs = require('fs-extra')
const path = require('path')
const { validate } = require('../middleware/validate')
const { createPresentationSchema, updatePresentationSchema } = require('../middleware/schemas')
const { rasterizeComplexElements } = require('../services/pptx-exporter')

const router = express.Router()

// GET /api/presentations - list summaries (excludes trashed)
router.get('/', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const active = presentations.filter((p) => !p.deletedAt)
    const summaries = active.map((p) => ({
      id: p.id,
      title: p.title,
      theme: p.theme,
      transition: p.transition,
      slideCount: (p.slides || []).length,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      thumbnail: p.slides && p.slides[0] ? p.slides[0].background : null,
    }))
    res.json(summaries)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations - create new (optionally from template)
router.post('/', validate(createPresentationSchema), async (req, res) => {
  try {
    const {
      title,
      theme,
      transition,
      templateId,
      slides: providedSlides,
      ...extraFields
    } = req.body
    const now = new Date().toISOString()
    const { readTemplates } = require('../services/storage')
    let presentation

    if (providedSlides && Array.isArray(providedSlides)) {
      presentation = normalizePresentationNotes({
        ...extraFields,
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: theme || extraFields.theme || 'black',
        transition: transition || extraFields.transition || 'slide',
        slides: providedSlides.map((s) => ({
          ...s,
          id: s.id || uuidv4(),
          elements: (s.elements || []).map((el) => ({ ...el, id: el.id || uuidv4() })),
        })),
        createdAt: now,
        updatedAt: now,
      })
      delete presentation.isTemplate
      delete presentation.description
      delete presentation.thumbnail
    } else if (templateId) {
      const templates = await readTemplates()
      let template = templates.find((t) => t.id === templateId)
      if (!template) {
        try {
          const builtIn = await fs.readJson(
            path.join(__dirname, '..', 'data', 'built-in-templates.json')
          )
          template = builtIn.find((t) => t.id === templateId)
          // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (e) {}
      }
      if (template) {
        const cloned = JSON.parse(JSON.stringify(template))
        presentation = normalizePresentationNotes({
          ...cloned,
          id: uuidv4(),
          title: title || cloned.title || 'Untitled Presentation',
          createdAt: now,
          updatedAt: now,
          slides: (cloned.slides || []).map((s) => ({
            ...s,
            id: uuidv4(),
            elements: (s.elements || []).map((el) => ({ ...el, id: uuidv4() })),
          })),
        })
        delete presentation.isTemplate
      }
    }

    if (!presentation) {
      presentation = normalizePresentationNotes({
        id: uuidv4(),
        title: title || 'Untitled Presentation',
        theme: theme || 'black',
        transition: transition || 'slide',
        slides: [
          {
            id: uuidv4(),
            elements: [
              {
                id: uuidv4(),
                type: 'text',
                x: 80,
                y: 160,
                width: 800,
                height: 220,
                zIndex: 1,
                content:
                  '<h2 style="text-align: center">Welcome to your presentation</h2><p style="text-align: center">Double-click to start editing</p>',
              },
            ],
            notes: '',
            background: { type: 'color', color: '#1e1e2e' },
          },
        ],
        createdAt: now,
        updatedAt: now,
        presenterTools: extraFields.presenterTools || {
          themeToggle: true,
          fontZoom: true,
          slideMenu: false,
          chalkboard: false,
        },
      })
    }

    const result = await withPresentations((presentations) => {
      presentations.push(presentation)
      return presentation
    })
    res.status(201).json(normalizePresentationNotes(result))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
// GET /api/presentations/trash/list — list trashed presentations
router.get('/trash/list', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const trashed = presentations
      .filter((p) => p.deletedAt)
      .map((p) => ({
        id: p.id,
        title: p.title,
        slideCount: (p.slides || []).length,
        deletedAt: p.deletedAt,
        updatedAt: p.updatedAt,
        thumbnail: p.slides && p.slides[0] ? p.slides[0].background : null,
      }))
    res.json(trashed)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function getLocalBaseUrl(req) {
  const localPort = req.socket?.localPort || process.env.PORT
  const host = req.get('host')
  if (localPort) return `http://127.0.0.1:${localPort}`
  return host ? `${req.protocol || 'http'}://${host}` : ''
}

// POST /api/presentations/raster-elements
router.post('/raster-elements', async (req, res) => {
  try {
    const presentation = req.body?.presentation
    if (!presentation || !Array.isArray(presentation.slides)) {
      return res.status(400).json({ error: 'Invalid presentation payload' })
    }

    const rasters = await rasterizeComplexElements(presentation, { baseUrl: getLocalBaseUrl(req) })
    res.json({ rasters })
  } catch (err) {
    console.error('PPTX element rasterization failed:', err)
    res.status(500).json({ error: 'PPTX element rasterization failed', details: err.message })
  }
})

// GET /api/presentations/:id
router.get('/:id', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const presentation = presentations.find((p) => p.id === req.params.id)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    res.json(normalizePresentationNotes(presentation))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/presentations/:id
router.put('/:id', validate(updatePresentationSchema), async (req, res) => {
  try {
    const result = await withPresentations((presentations) => {
      const index = presentations.findIndex((p) => p.id === req.params.id)
      if (index === -1) return null
      presentations[index] = normalizePresentationNotes({
        ...presentations[index],
        ...req.body,
        id: req.params.id,
        updatedAt: new Date().toISOString(),
      })
      return presentations[index]
    })
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(normalizePresentationNotes(result))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id — soft delete (move to trash)
router.delete('/:id', async (req, res) => {
  try {
    const presId = req.params.id
    const result = await withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === presId)
      if (!pres) return null
      pres.deletedAt = new Date().toISOString()
      return true
    })
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/restore — restore from trash
router.post('/:id/restore', async (req, res) => {
  try {
    const presId = req.params.id
    const result = await withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === presId)
      if (!pres || !pres.deletedAt) return null
      delete pres.deletedAt
      pres.updatedAt = new Date().toISOString()
      return pres
    })
    if (!result) return res.status(404).json({ error: 'Not found or not in trash' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/presentations/:id/permanent — permanently delete
router.delete('/:id/permanent', async (req, res) => {
  try {
    const presId = req.params.id
    const result = await withPresentations((presentations) => {
      const index = presentations.findIndex((p) => p.id === presId)
      if (index === -1) return null
      presentations.splice(index, 1)
      return true
    })
    if (!result) return res.status(404).json({ error: 'Not found' })

    // Cascade: remove share tokens
    try {
      await withShareTokens((tokens) => {
        for (const [token, tokenData] of Object.entries(tokens)) {
          const presentationId =
            typeof tokenData === 'string' ? tokenData : tokenData?.presentationId
          if (presentationId === presId) {
            delete tokens[token]
          }
        }
      })
    } catch {}

    // Cascade: remove history snapshots
    try {
      const presHistDir = path.join(HISTORY_DIR, presId)
      if (fs.existsSync(presHistDir)) fs.removeSync(presHistDir)
    } catch {}

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  try {
    const result = await withPresentations(async (presentations) => {
      const original = presentations.find((p) => p.id === req.params.id)
      if (!original) return null
      const now = new Date().toISOString()
      const copy = JSON.parse(JSON.stringify(original))
      copy.id = uuidv4()
      copy.title = (copy.title || 'Untitled') + ' (copy)'
      copy.createdAt = now
      copy.updatedAt = now
      const normalizedCopy = normalizePresentationNotes(copy)
      presentations.push(normalizedCopy)
      return normalizedCopy
    })
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/export
router.get('/:id/export', async (req, res) => {
  try {
    const presentations = await readPresentations()
    const presentation = presentations.find((p) => p.id === req.params.id)
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    const html = generateRevealHTML(normalizePresentationNotes(presentation))
    const filename = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/presentations/:id/present
router.get('/:id/present', async (req, res) => {
  try {
    const presentations = await readPresentations()
    let presentation = presentations.find((p) => p.id === req.params.id)
    if (!presentation) {
      const { readTemplates } = require('../services/storage')
      const templates = await readTemplates()
      presentation = templates.find((t) => t.id === req.params.id)
      if (!presentation) {
        try {
          const fs = require('fs-extra')
          const path = require('path')
          const builtIn = await fs.readJson(
            path.join(__dirname, '..', 'data', 'built-in-templates.json')
          )
          presentation = builtIn.find((t) => t.id === req.params.id)
          // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (e) {}
      }
    }
    if (!presentation) return res.status(404).json({ error: 'Not found' })
    let html = generateRevealHTML(normalizePresentationNotes(presentation))
    if (req.query.preview === 'true') {
      html = html.replace(
        '</head>',
        '<style>.reveal .controls, .reveal .progress, .reveal .slide-number, .reveal .navigate-left, .reveal .navigate-right, .reveal .navigate-up, .reveal .navigate-down { display: none !important; pointer-events: none !important; }</style></head>'
      )
      html = html.replace(
        'var revealConfig = {',
        'var revealConfig = { controls: false, progress: false, keyboard: false,'
      )
    }
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/presentations/:id/save-as-template
router.post('/:id/save-as-template', async (req, res) => {
  try {
    const { readTemplates, writeTemplates } = require('../services/storage')
    const presentations = await readPresentations()
    const pres = presentations.find((p) => p.id === req.params.id)
    if (!pres) return res.status(404).json({ error: 'Not found' })
    const now = new Date().toISOString()
    const template = normalizePresentationNotes({
      ...JSON.parse(JSON.stringify(pres)),
      id: uuidv4(),
      title: (req.body.title || pres.title || 'Untitled') + ' (template)',
      isTemplate: true,
      createdAt: now,
      updatedAt: now,
    })
    const templates = await readTemplates()
    templates.push(template)
    await writeTemplates(templates)
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
