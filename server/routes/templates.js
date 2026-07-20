const express = require('express')
const uuidv4 = () => require('node:crypto').randomUUID()
const { readTemplates, withTemplates } = require('../services/storage')
const { normalizePresentationNotes } = require('revealjs-shared')
const { validate } = require('../middleware/validate')
const { createTemplateSchema, updateTemplateSchema } = require('../middleware/schemas')
const { releasePackageOwner } = require('../services/package-lifecycle-integration')
const { sanitizeClientEditableData } = require('../services/pptx-import/authority-sanitizer')
const { toPresentationEditorDto } = require('../services/pptx-import/package-store/dto')

const router = express.Router()

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const templates = await readTemplates()
    const summaries = templates.map((t) => ({
      id: t.id,
      title: t.title,
      theme: t.theme,
      transition: t.transition,
      slideCount: (t.slides || []).length,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
      thumbnail: t.slides && t.slides[0] ? t.slides[0].background : null,
    }))
    res.json(summaries)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/templates
router.post('/', validate(createTemplateSchema), async (req, res) => {
  try {
    const now = new Date().toISOString()
    const template = normalizePresentationNotes({
      ...sanitizeClientEditableData(req.body),
      id: uuidv4(),
      isTemplate: true,
      createdAt: now,
      updatedAt: now,
    })
    await withTemplates((templates) => {
      templates.push(template)
    })
    res.status(201).json(toPresentationEditorDto(normalizePresentationNotes(template)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/templates/:id
router.get('/:id', async (req, res) => {
  try {
    const templates = await readTemplates()
    const template = templates.find((t) => t.id === req.params.id)
    if (!template) return res.status(404).json({ error: 'Not found' })
    res.json(toPresentationEditorDto(normalizePresentationNotes(template)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/templates/:id
router.put('/:id', validate(updateTemplateSchema), async (req, res) => {
  try {
    const updated = await withTemplates((templates) => {
      const index = templates.findIndex((t) => t.id === req.params.id)
      if (index === -1) return null
      templates[index] = normalizePresentationNotes({
        ...templates[index],
        ...sanitizeClientEditableData(req.body),
        id: req.params.id,
        updatedAt: new Date().toISOString(),
      })
      return templates[index]
    })
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(toPresentationEditorDto(normalizePresentationNotes(updated)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const template = (await readTemplates()).find((item) => item.id === req.params.id)
    if (!template) return res.status(404).json({ error: 'Not found' })

    try {
      await releasePackageOwner({ ownerType: 'template', ownerId: req.params.id })
    } catch {
      return res.status(503).json({
        error: 'Package lifecycle is temporarily unavailable; retry deletion',
        code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
        retryable: true,
      })
    }

    const deleted = await withTemplates((templates) => {
      const index = templates.findIndex((t) => t.id === req.params.id)
      if (index === -1) return false
      templates.splice(index, 1)
      return true
    })
    if (!deleted) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
