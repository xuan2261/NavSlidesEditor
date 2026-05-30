/**
 * Pure slide analysis for the Design Ideas engine.
 *
 * `analyzeSlide(slide)` distills a slide into a small, deterministic feature
 * record that the suggestion rule table consumes. No side effects, never
 * throws on null/empty input, and never mutates the slide.
 */

// Minimal HTML -> visible text. Strips tags, decodes the handful of entities
// our editor emits, collapses whitespace. Length-of-content only; we never
// render this string, so a tiny decode map is sufficient (KISS).
const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
}

function visibleText(html) {
  if (typeof html !== 'string' || html.length === 0) return ''
  const noTags = html.replace(/<[^>]*>/g, ' ')
  const decoded = noTags.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, (m) => ENTITIES[m] || ' ')
  return decoded.replace(/\s+/g, ' ').trim()
}

// Where each element type carries user-visible text we should measure.
function elementText(el) {
  if (!el || typeof el !== 'object') return ''
  // text/code/markdown/html keep their body in `content`; shapes carry an
  // optional placeholder label in `text`.
  if (typeof el.content === 'string') return visibleText(el.content)
  if (typeof el.text === 'string') return visibleText(el.text)
  return ''
}

/** Bucket a slide by element count + visible text volume. */
function classifyDensity(elementCount, textLength) {
  if (elementCount === 0) return 'empty'
  if (textLength > 250 || elementCount >= 8) return 'dense'
  if (elementCount <= 3 && textLength <= 120) return 'sparse'
  return 'medium'
}

/**
 * @param {object|null} slide - `{ elements: [...] }` shape (other keys ignored).
 * @returns {{
 *   elementCount: number,
 *   types: string[],            // sorted, unique
 *   textLength: number,         // total visible chars across elements
 *   hasImage: boolean,
 *   hasChart: boolean,
 *   hasTable: boolean,
 *   hasCode: boolean,
 *   density: 'empty'|'sparse'|'medium'|'dense',
 *   titleOnly: boolean,
 * }}
 */
export function analyzeSlide(slide) {
  const elements = Array.isArray(slide?.elements) ? slide.elements : []
  const typeSet = new Set()
  let textLength = 0

  for (const el of elements) {
    if (el && typeof el.type === 'string') typeSet.add(el.type)
    textLength += elementText(el).length
  }

  const types = [...typeSet].sort()
  const elementCount = elements.length
  const density = classifyDensity(elementCount, textLength)

  // Title-only: one or two short text blocks and nothing else (the classic
  // title / section-header shape). The text guard keeps a long two-paragraph
  // slide out of this bucket even though it is text-only.
  const titleOnly =
    elementCount >= 1 &&
    elementCount <= 2 &&
    types.length === 1 &&
    types[0] === 'text' &&
    textLength <= 80

  return {
    elementCount,
    types,
    textLength,
    hasImage: typeSet.has('image'),
    hasChart: typeSet.has('chart'),
    hasTable: typeSet.has('table'),
    hasCode: typeSet.has('code'),
    density,
    titleOnly,
  }
}
