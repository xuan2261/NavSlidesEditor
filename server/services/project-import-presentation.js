const {
  getDesignTokensForRevealTheme,
  normalizePresentationNotes,
} = require('revealjs-shared')
const { sanitizeClientEditableData } = require('./pptx-import/authority-sanitizer')

function rewriteMedia(presentation, placements) {
  const urlMap = Object.fromEntries(
    placements.filter((item) => item.originalUrl).map((item) => [
      item.originalUrl,
      `/uploads/${item.filename}`,
    ])
  )
  const clone = structuredClone(presentation)
  const visit = (slides) => (slides || []).forEach((slide) => {
    for (const element of slide.elements || []) {
      if (urlMap[element.src]) element.src = urlMap[element.src]
      if (urlMap[element.poster]) element.poster = urlMap[element.poster]
      for (const track of element.tracks || []) {
        if (urlMap[track?.src]) track.src = urlMap[track.src]
      }
    }
    const background = slide.background
    const source = background?.image || background?.src
    if (background?.type === 'image' && urlMap[source]) {
      background.image = urlMap[source]
      delete background.src
    }
    visit(slide.children)
  })
  visit(clone.slides)
  return clone
}

function buildImportedPresentation(record) {
  const safe = sanitizeClientEditableData(rewriteMedia(record.presentation, record.placements || []))
  const now = record.commitStartedAt
  const theme = safe.theme || 'black'
  return normalizePresentationNotes({
    ...safe,
    id: record.intendedPresentationId,
    title: `${safe.title || 'Imported'} (Imported)`,
    theme,
    transition: safe.transition || 'slide',
    designTokens: safe.designTokens || getDesignTokensForRevealTheme(theme),
    slides: safe.slides,
    createdAt: now,
    updatedAt: now,
    _projectImport: {
      sessionId: record.sessionId,
      payloadDigest: record.payloadDigest,
    },
  })
}

module.exports = { buildImportedPresentation }
