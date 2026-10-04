const {
  getDesignTokensForRevealTheme,
  normalizePresentationNotes,
  normalizePresentationGames,
  rewriteGameMediaUrls,
} = require('revealjs-shared')
const { sanitizeClientEditableData } = require('./pptx-import/authority-sanitizer')

function rewriteMedia(presentation, placements) {
  const urlMap = Object.fromEntries(
    placements
      .filter((item) => item.originalUrl)
      .map((item) => [item.originalUrl, `/uploads/${item.filename}`])
  )
  return rewriteGameMediaUrls(presentation, urlMap)
}

function buildImportedPresentation(record) {
  const safe = sanitizeClientEditableData(
    rewriteMedia(record.presentation, record.placements || [])
  )
  const now = record.commitStartedAt
  const theme = safe.theme || 'black'
  return normalizePresentationGames(
    normalizePresentationNotes({
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
  )
}

module.exports = { buildImportedPresentation }
