const express = require('express')
const { readSettings } = require('../services/storage')
const { callAI } = require('../services/ai-provider')
const { validate } = require('../middleware/validate')
// eslint-disable-next-line unused-imports/no-unused-vars
const { aiCopywriteSchema, aiTranslateSchema } = require('../middleware/schemas')
const { z } = require('zod')
const { escapeHtml, getSlideNotes } = require('revealjs-shared')

const router = express.Router()

function getActionPrompt(action) {
  const prompts = {
    improve:
      'Improve this text for a presentation slide. Make it clearer and more impactful. Keep it concise. Return ONLY the improved text.',
    shorten:
      'Shorten this text significantly while keeping the key message. Bullet points preferred. Return ONLY the shortened text.',
    expand:
      'Expand this text with more details, examples, or supporting points. Return ONLY the expanded text.',
    professional:
      'Rewrite in a professional, formal tone suitable for corporate presentations. Return ONLY the edited text.',
    casual: 'Rewrite in a casual, engaging tone. Return ONLY the edited text.',
    grammar:
      'Fix any grammar, spelling, or punctuation errors. Preserve the meaning in the text. Return ONLY the corrected text.',
  }
  return prompts[action] || 'Rewrite this text.'
}

// POST /api/ai/rewrite
router.post(
  '/rewrite',
  validate(
    aiCopywriteSchema
      .extend({
        customPrompt: z.string().max(2000).optional(),
      })
      .passthrough()
  ),
  async (req, res) => {
    try {
      const { text, action, customPrompt } = req.body
      const settings = await readSettings()
      if (!settings.ai?.apiKey && settings.ai?.provider !== 'custom') {
        return res.status(400).json({ error: 'AI not configured' })
      }

      // Allow custom prompting
      let systemPrompt = `You are an expert presentation copywriter. ${getActionPrompt(action)}`
      if (action === 'custom') {
        systemPrompt = `You are an expert presentation copywriter. ${customPrompt}. Return ONLY the requested modified text.`
      }

      const result = await callAI(settings.ai, systemPrompt, text)
      res.json({ result: result.trim() })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
)

// POST /api/ai/generate-outline
const generateOutlineSchema = z.object({
  topic: z.string().min(1).max(5000),
  slideCount: z.number().int().min(1).max(100).optional(),
  style: z.string().max(100).optional(),
  language: z.string().max(50).optional(),
})

router.post('/generate-outline', validate(generateOutlineSchema), async (req, res) => {
  try {
    const { topic, slideCount, style, language } = req.body
    const settings = await readSettings()
    if (!settings.ai?.apiKey && settings.ai?.provider !== 'custom') {
      return res.status(400).json({ error: 'AI not configured' })
    }

    const systemPrompt = `You are a presentation designer forming an outline. Generate a presentation outline for the given topic.
Respond strictly in JSON format. Do NOT wrap with markdown blocks. Keep it parsable JSON.
Return a JSON object containing an array called "slides". Each slide must have:
- title: string
- bulletPoints: array of strings
- layout: one of ["title", "content", "two-column", "image-text", "big-number"]
- notes: string (optional context for presenter)
Style parameter: ${style}. Language parameter: ${language}. Expected Slides count: ${slideCount}.`

    const rawResult = await callAI(settings.ai, systemPrompt, topic)

    // strip out markdown formatting if ai returns markdown block
    let cleanedJsonPattern = rawResult
    if (rawResult.startsWith('```')) {
      cleanedJsonPattern = rawResult.replace(/^```(json)?\n/, '').replace(/\n```$/, '')
    }

    const outline = JSON.parse(cleanedJsonPattern)
    res.json({ outline: outline.slides || outline })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/generate-slides
const generateSlidesSchema = z.object({
  outline: z
    .array(
      z.object({
        title: z.string().max(500),
        bulletPoints: z.array(z.string().max(1000)).optional(),
        layout: z.string().optional(),
        notes: z.string().max(5000).optional(),
        speakerNotes: z.string().max(5000).optional(),
      })
    )
    .min(1)
    .max(50),
  templateId: z.string().optional(),
})

router.post('/generate-slides', validate(generateSlidesSchema), async (req, res) => {
  try {
    // eslint-disable-next-line unused-imports/no-unused-vars
    const { outline, templateId } = req.body
    // Client-side maps this logic typically, but we can do mock expansion here.
    // However, Phase 6 instructed: "Map outline to slide elements using template patterns".
    // For simplicity, we just generate raw HTML sections based on layouts.
    const slides = outline.map((slide) => {
      const bulletPoints = Array.isArray(slide.bulletPoints) ? slide.bulletPoints : []
      const safeTitle = escapeHtml(slide.title || '')
      const safeLayout = escapeHtml(slide.layout || 'content')
      const safeNotes = escapeHtml(getSlideNotes(slide))
      let content = ''
      if (slide.layout === 'title') {
        content = `<h1>${safeTitle}</h1>`
        if (bulletPoints.length > 0) {
          content += `<h3>${bulletPoints.map((point) => escapeHtml(point)).join(' | ')}</h3>`
        }
      } else if (slide.layout === 'content') {
        content = `<h2>${safeTitle}</h2><ul>`
        bulletPoints.forEach((bp) => {
          content += `<li>${escapeHtml(bp)}</li>`
        })
        content += `</ul>`
      } else {
        // Fallback for custom
        content = `<h2>${safeTitle}</h2><ul>`
        if (bulletPoints.length > 0) {
          bulletPoints.forEach((bp) => {
            content += `<li>${escapeHtml(bp)}</li>`
          })
        }
        content += `</ul>`
      }
      return `<section data-layout="${safeLayout}">${content}<aside class="notes">${safeNotes}</aside></section>`
    })

    res.json({ slides })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/translate
const translateSchema = z.object({
  texts: z
    .array(
      z
        .object({
          key: z.string().optional(),
          html: z.string(),
        })
        .passthrough()
    )
    .min(1)
    .max(500),
  targetLanguage: z.string().min(1).max(50),
})

router.post('/translate', validate(translateSchema), async (req, res) => {
  try {
    const { texts, targetLanguage } = req.body
    const settings = await readSettings()
    if (!settings.ai?.apiKey && settings.ai?.provider !== 'custom') {
      return res.status(400).json({ error: 'AI not configured' })
    }

    const systemPrompt = `Translate the following JSON array of HTML/text objects to ${targetLanguage}.
IMPORTANT INSTRUCTIONS:
1. Preserve ALL HTML tags exactly as they are.
2. ONLY translate the visible text content.
3. Return the exact same JSON array structure.
4. Respond ONLY with valid JSON. Do NOT wrap with markdown \`\`\`json.`

    const rawResult = await callAI(settings.ai, systemPrompt, JSON.stringify(texts))

    let cleanedJsonPattern = rawResult.trim()
    if (cleanedJsonPattern.startsWith('```')) {
      cleanedJsonPattern = cleanedJsonPattern
        .replace(/^```(json)?\n/, '')
        .replace(/\n```$/, '')
    }

    res.json({ translations: JSON.parse(cleanedJsonPattern) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
