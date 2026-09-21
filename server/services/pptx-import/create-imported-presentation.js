const uuidv4 = () => require('node:crypto').randomUUID()
const {
  getDesignTokensForRevealTheme,
  normalizeElementAction,
  normalizeImageAccessibility,
  normalizeMediaAccessibility,
  normalizePresentationNotes,
  normalizeSlideConnectorConnections,
} = require('revealjs-shared')
const { withPresentations } = require('../storage')
const { toPptxOriginalMeta } = require('./original-package')
const { stripControlChars } = require('../../utils/strip-control-chars')

/**
 * A title originates in the uploaded filename (multer `originalname`) or in the
 * deck's own OOXML, so it carries attacker-influenced bytes into operator-facing
 * sinks — notably the GitHub push commit message. Clean it at the one place every
 * import path stamps a title rather than at each sink.
 */
function sanitizeImportedTitle(value) {
  return stripControlChars(value).replace(/\s+/g, ' ').trim()
}

/**
 * Normalize mapped import output into a presentation projection without pushing
 * to presentations.json. Package-backed imports feed this into the outbox only.
 */
function stampImportedPresentationFields(mappedPresentation, options = {}) {
  function normalizeImportedElement(element) {
    const { action } = normalizeElementAction(element?.action)
    const withAction = action ? { ...element, action } : element
    return normalizeMediaAccessibility(normalizeImageAccessibility(withAction))
  }

  function normalizeImportedSlide(slide) {
    const children = Array.isArray(slide.children)
      ? slide.children.map(normalizeImportedSlide)
      : slide.children
    const elements = normalizeSlideConnectorConnections(
      (slide.elements || []).map(normalizeImportedElement)
    )
    return {
      ...slide,
      elements,
      ...(children !== slide.children ? { children } : {}),
    }
  }

  const now = new Date().toISOString()
  const createdAt = options.createdAt || options.timestamp || now
  const updatedAt = options.updatedAt || options.timestamp || createdAt
  const source =
    mappedPresentation && typeof mappedPresentation === 'object' ? mappedPresentation : {}
  const theme = source.theme || 'black'
  const designTokens = source.designTokens || getDesignTokensForRevealTheme(theme)
  const originalArtifact = options.originalArtifact
  const pptxOriginal = originalArtifact ? toPptxOriginalMeta(originalArtifact) : undefined

  const presentation = normalizePresentationNotes({
    ...source,
    id: options.id || uuidv4(),
    title:
      sanitizeImportedTitle(source.title) ||
      sanitizeImportedTitle(options.originalName) ||
      'Imported Presentation',
    theme,
    transition: source.transition || 'slide',
    designTokens,
    slides: (source.slides || [])
      .map((s) => ({
        ...s,
        id: s.id || uuidv4(),
        elements: (s.elements || []).map((el) => ({ ...el, id: el.id || uuidv4() })),
      }))
      .map(normalizeImportedSlide),
    pptxOriginal,
    ...(options.packageHead ? { pptxAggregateHead: options.packageHead } : {}),
    ...(options.importReport ? { _pptxImportReport: options.importReport } : {}),
    createdAt,
    updatedAt,
  })
  delete presentation.isTemplate
  delete presentation.description
  delete presentation.thumbnail
  // Never persist client path fields if mapper/client leaked them
  if (presentation.pptxOriginal) {
    delete presentation.pptxOriginal.filename
    delete presentation.pptxOriginal.path
    delete presentation.pptxOriginal.filePath
  }
  // Server-owned report wins over any leaked client/mapper field when options omit it.
  if (options.importReport) presentation._pptxImportReport = options.importReport
  return presentation
}

/**
 * Server-side atomic presentation create after PPTX import (legacy / non-package path).
 * Never accepts client filesystem paths for pptxOriginal.
 */
async function createImportedPresentation(mappedPresentation, originalArtifact, options = {}) {
  const presentation = stampImportedPresentationFields(mappedPresentation, {
    ...options,
    originalArtifact,
    // importReport from options is applied by stamp (server-owned).
  })

  return withPresentations((presentations) => {
    presentations.push(presentation)
    return presentation
  })
}

async function deleteImportedPresentation(id) {
  if (!id) return false
  return withPresentations((presentations) => {
    const index = presentations.findIndex((presentation) => presentation.id === id)
    if (index === -1) return false
    presentations.splice(index, 1)
    return true
  })
}

/**
 * Strip client-supplied original path bindings from create body (RT-04).
 */
function stripClientPptxOriginalPaths(body) {
  if (!body || typeof body !== 'object') return body
  if (!body.pptxOriginal) return body
  const next = { ...body }
  delete next.pptxOriginal
  return next
}

module.exports = {
  createImportedPresentation,
  deleteImportedPresentation,
  stampImportedPresentationFields,
  stripClientPptxOriginalPaths,
}
