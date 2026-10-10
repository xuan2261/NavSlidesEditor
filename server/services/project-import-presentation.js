const {
  getDesignTokensForRevealTheme,
  normalizePresentationNotes,
  normalizePresentationGames,
  collectGameMediaReferences,
  rewriteGameMediaUrls,
} = require('revealjs-shared')
const { sanitizeClientEditableData } = require('./pptx-import/authority-sanitizer')

function visitPresentationMedia(presentation, update) {
  const fields = (node, keys) => {
    if (!node || typeof node !== 'object') return
    for (const key of keys) if (typeof node[key] === 'string' && node[key]) {
      const updated = update(node[key])
      if (updated !== node[key]) node[key] = updated
    }
  }
  const element = (node) => {
    fields(node, ['src', 'videoUrl', 'poster'])
    for (const track of node?.tracks || []) fields(track, ['src'])
    for (const child of node?.elements || node?.children || []) element(child)
    fields(node?.background, ['image', 'src', 'video', 'videoUrl', 'poster'])
  }
  const slide = (node) => {
    fields(node?.background, ['image', 'src', 'video', 'videoUrl', 'poster'])
    for (const item of node?.elements || []) element(item)
    for (const item of node?.fixedElements || []) element(item)
    for (const patch of Object.values(node?.layoutOverrides?.elementPatches || {})) element(patch)
    for (const child of node?.children || []) slide(child)
  }
  slide(presentation)
  for (const node of presentation?.slides || []) slide(node)
  for (const node of presentation?.layoutMasters || []) slide(node)
}

function collectMediaUrls(presentation) {
  const urls = []
  visitPresentationMedia(presentation, (url) => { urls.push(url); return url })
  for (const { url } of collectGameMediaReferences(presentation)) {
    if (!urls.includes(url)) urls.push(url)
  }
  return urls
}

function rewritePresentationMedia(presentation, mediaUrlMap) {
  const replacement = (url) => {
    const suffix = url.match(/[?#].*$/u)?.[0] || ''
    const base = suffix ? url.slice(0, -suffix.length) : url
    const mapped = Object.hasOwn(mediaUrlMap, url) ? mediaUrlMap[url]
      : Object.hasOwn(mediaUrlMap, base) ? mediaUrlMap[base] : undefined
    return mapped === undefined ? url : `${mapped}${suffix && !/[?#]/u.test(mapped) ? suffix : ''}`
  }
  const nativeMap = Object.fromEntries(collectGameMediaReferences(presentation)
    .map(({ url }) => [url, replacement(url)])
    .filter(([url, mapped]) => mapped !== url))
  // The canonical rewriter validates native image replacements and includes retained configs,
  // layout patches and placeholder defaults; the general traversal covers package media too.
  const clone = rewriteGameMediaUrls(presentation, nativeMap)
  visitPresentationMedia(clone, replacement)
  return clone
}

function rewriteMedia(presentation, placements) {
  return rewritePresentationMedia(presentation, Object.fromEntries(placements
    .filter((item) => item.originalUrl).map((item) => [item.originalUrl, `/uploads/${item.filename}`])))
}

function buildImportedPresentation(record) {
  const safe = sanitizeClientEditableData(
    rewriteMedia(record.presentation, record.placements || [])
  )
  const now = record.commitStartedAt
  if (record.packageOutcome) {
    return normalizePresentationNotes({
      ...safe, id: record.intendedPresentationId, createdAt: now, updatedAt: now,
      pptxAggregateHead: structuredClone(record.packageOutcome.head),
      _projectImport: { sessionId: record.sessionId, payloadDigest: record.payloadDigest },
    })
  }
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

module.exports = { buildImportedPresentation, collectMediaUrls, rewritePresentationMedia }
