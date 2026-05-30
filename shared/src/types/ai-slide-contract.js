// Versioned, runtime-validated contract for AI-generated element-based slides.
//
// This is a roadmap seed: a future AI-layout server can return `elementSlides`
// and the client consumes them WITHOUT change — but only after validateAiSlides
// accepts the payload. The validator is load-bearing security, not speculative
// generality: it gates an external-server→content trust path that would
// otherwise feed straight into the client's element render sinks.
//
// @typedef {Object} AiSlideElement
// @property {string} type   Must be on SAFE_ELEMENT_TYPES (NOT html/code/svg).
// @property {number} [x]
// @property {number} [y]
// @property {number} [width]
// @property {number} [height]
// @property {number} [zIndex]
// @property {string} [content] Sanitized before reaching state.
//
// @typedef {Object} AiGeneratedSlide
// @property {AiSlideElement[]} elements
// @property {string} [notes]
//
// @typedef {Object} AiSlidePayload
// @property {number} contractVersion
// @property {AiGeneratedSlide[]} slides

const { sanitizeRichTextHtml } = require('../content-safety.js')

const AI_SLIDE_CONTRACT_VERSION = 1

// Element types safe for AI/server-supplied content. EXCLUDES html/code/svg —
// those render into a scripts-enabled iframe (html), unsanitized hljs (code),
// or raw inline SVG, so they are NOT allowed from an untrusted contract source.
const SAFE_ELEMENT_TYPES = new Set([
  'text',
  'image',
  'shape',
  'table',
  'callout',
  'icon',
  'line',
  'chart',
  'timeline',
  'markdown',
  'qr',
])

/**
 * Validate + sanitize an AI slide payload. Returns the sanitized slides array
 * on success; throws on any contract violation (caught upstream → alert).
 *
 * @param {AiSlidePayload} payload
 * @returns {AiGeneratedSlide[]}
 */
function validateAiSlides(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('AI slide payload must be an object')
  }
  if (payload.contractVersion !== AI_SLIDE_CONTRACT_VERSION) {
    throw new Error(
      `Unsupported AI slide contractVersion: ${payload.contractVersion} (expected ${AI_SLIDE_CONTRACT_VERSION})`
    )
  }
  if (!Array.isArray(payload.slides)) {
    throw new Error('AI slide payload.slides must be an array')
  }

  return payload.slides.map((slide, si) => {
    if (!slide || typeof slide !== 'object' || !Array.isArray(slide.elements)) {
      throw new Error(`AI slide #${si} must have an elements array`)
    }
    const elements = slide.elements.map((el, ei) => {
      if (!el || typeof el !== 'object' || typeof el.type !== 'string') {
        throw new Error(`AI slide #${si} element #${ei} is malformed`)
      }
      if (!SAFE_ELEMENT_TYPES.has(el.type)) {
        throw new Error(
          `AI slide #${si} element #${ei} has disallowed type "${el.type}"`
        )
      }
      return {
        ...el,
        content: el.content != null ? sanitizeRichTextHtml(el.content) : el.content,
      }
    })
    return { ...slide, elements, notes: typeof slide.notes === 'string' ? slide.notes : '' }
  })
}

module.exports = {
  AI_SLIDE_CONTRACT_VERSION,
  SAFE_ELEMENT_TYPES,
  validateAiSlides,
}
