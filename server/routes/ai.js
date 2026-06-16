const express = require('express')
const { readSettings } = require('../services/storage')
const { callAI } = require('../services/ai-provider')
const { validate } = require('../middleware/validate')
// eslint-disable-next-line unused-imports/no-unused-vars
const { aiCopywriteSchema, aiTranslateSchema } = require('../middleware/schemas')
const { z } = require('zod')
const { escapeHtml, getSlideNotes } = require('revealjs-shared')

const router = express.Router()

function logAiError(context, err) {
  const message = err?.message || String(err || 'Unknown AI error')
  const safeMessage = message
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, '<REDACTED_TOKEN>')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{8,})\b/g, '<REDACTED_TOKEN>')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]{12,}/gi, '$1<REDACTED_TOKEN>')
  console.error(`[AI:${context}]`, safeMessage)
}

function sendAiProviderFailure(res) {
  return res.status(502).json({ error: 'AI provider request failed' })
}

function cleanJsonBlock(rawResult) {
  const raw = String(rawResult || '').trim()
  if (!raw.startsWith('```')) return raw
  return raw.replace(/^```(json)?\n/, '').replace(/\n```$/, '')
}

const outlineResponseSchema = z.object({
  slides: z
    .array(
      z.object({
        title: z.string(),
        bulletPoints: z.array(z.string()).optional(),
        layout: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .min(1)
    .max(100),
})

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

      let result
      try {
        result = await callAI(settings.ai, systemPrompt, text)
      } catch (err) {
        logAiError('rewrite', err)
        return sendAiProviderFailure(res)
      }
      res.json({ result: result.trim() })
    } catch (err) {
      logAiError('rewrite', err)
      res.status(500).json({ error: 'Internal server error' })
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

    let rawResult
    try {
      rawResult = await callAI(settings.ai, systemPrompt, topic)
    } catch (err) {
      logAiError('generate-outline-provider', err)
      return sendAiProviderFailure(res)
    }

    let parsed
    try {
      parsed = JSON.parse(cleanJsonBlock(rawResult))
    } catch (err) {
      logAiError('generate-outline-json', err)
      return res.status(502).json({ error: 'AI returned invalid outline' })
    }

    const normalized = Array.isArray(parsed) ? { slides: parsed } : parsed
    const validated = outlineResponseSchema.safeParse(normalized)
    if (!validated.success) {
      logAiError('generate-outline-schema', validated.error)
      return res.status(502).json({ error: 'AI returned invalid outline' })
    }

    res.json({ outline: validated.data.slides })
  } catch (err) {
    logAiError('generate-outline', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/ai/generate-slides
// DEPRECATED / caller-less in-repo: the client now builds slides locally from
// the outline via buildSlidesFromOutline (the route's escapeHtml treatment was
// ported there), so no in-repo code calls this endpoint. Kept (not deleted)
// because the app is self-hostable and an external HTTP client may still rely
// on it; hard removal is deferred to a future release after confirming no
// external traffic. This route only re-maps the outline to escaped <section>
// strings — it does not call AI.
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

    let rawResult
    try {
      rawResult = await callAI(settings.ai, systemPrompt, JSON.stringify(texts))
    } catch (err) {
      logAiError('translate-provider', err)
      return sendAiProviderFailure(res)
    }

    let parsed
    try {
      parsed = JSON.parse(cleanJsonBlock(rawResult))
    } catch (err) {
      logAiError('translate-json', err)
      return res.status(502).json({ error: 'AI provider request failed' })
    }

    res.json({ translations: parsed })
  } catch (err) {
    logAiError('translate', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
