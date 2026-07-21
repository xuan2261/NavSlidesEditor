const uuidv4 = () => require('node:crypto').randomUUID()
const { getDesignTokensForRevealTheme, normalizePresentationNotes } = require('revealjs-shared')
const { withPresentations } = require('../storage')
const { toPptxOriginalMeta } = require('./original-package')

/**
 * Server-side atomic presentation create after PPTX import.
 * Never accepts client filesystem paths for pptxOriginal.
 */
async function createImportedPresentation(mappedPresentation, originalArtifact, options = {}) {
  const now = new Date().toISOString()
  const createdAt = options.createdAt || options.timestamp || now
  const updatedAt = options.updatedAt || options.timestamp || createdAt
  const source = mappedPresentation && typeof mappedPresentation === 'object' ? mappedPresentation : {}
  const theme = source.theme || 'black'
  const designTokens = source.designTokens || getDesignTokensForRevealTheme(theme)
  const pptxOriginal = originalArtifact ? toPptxOriginalMeta(originalArtifact) : undefined

  const presentation = normalizePresentationNotes({
    ...source,
    id: options.id || uuidv4(),
    title: source.title || options.originalName || 'Imported Presentation',
    theme,
    transition: source.transition || 'slide',
    designTokens,
    slides: (source.slides || []).map((s) => ({
      ...s,
      id: s.id || uuidv4(),
      elements: (s.elements || []).map((el) => ({ ...el, id: el.id || uuidv4() })),
    })),
    pptxOriginal,
    ...(options.packageHead ? { pptxAggregateHead: options.packageHead } : {}),
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
  stripClientPptxOriginalPaths,
}
