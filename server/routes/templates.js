const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { readTemplates, writeTemplates } = require('../services/storage')

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
router.post('/', async (req, res) => {
  try {
    const now = new Date().toISOString()
    const template = {
      ...req.body,
      id: uuidv4(),
      isTemplate: true,
      createdAt: now,
      updatedAt: now,
    }
    const templates = await readTemplates()
    templates.push(template)
    await writeTemplates(templates)
    res.status(201).json(template)
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
    res.json(template)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/templates/:id
router.put('/:id', async (req, res) => {
  try {
    const templates = await readTemplates()
    const index = templates.findIndex((t) => t.id === req.params.id)
    if (index === -1) return res.status(404).json({ error: 'Not found' })
    templates[index] = {
      ...templates[index],
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString(),
    }
    await writeTemplates(templates)
    res.json(templates[index])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const templates = await readTemplates()
    const index = templates.findIndex((t) => t.id === req.params.id)
    if (index === -1) return res.status(404).json({ error: 'Not found' })
    templates.splice(index, 1)
    await writeTemplates(templates)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
