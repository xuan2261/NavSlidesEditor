const { safePart, canonicalRunAction } = require('./pptx-text-hyperlinks')
const hash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
function validateSourceSlides(document) {
  if (document.sourceSlides === undefined) return
  const seen = new Set()
  if (!Array.isArray(document.sourceSlides) || document.sourceSlides.length > 100000)
    throw new TypeError('Invalid source slide references')
  for (const record of document.sourceSlides) {
    if (!record || Array.isArray(record) || Object.keys(record).length !== 4 || !hash(record.sourceId) || !safePart(record.partUri) ||
      !hash(record.preconditionHash) || !canonicalRunAction({ kind: 'slide', slideId: record.slideId }))
      throw new TypeError('Invalid source slide reference')
    const key = `${record.sourceId}:${record.partUri}`
    if (seen.has(key)) throw new TypeError('Ambiguous source slide reference')
    seen.add(key)
  }
}
function resolveRunHyperlink(presentation, link) {
  const slides = [], visit = (items) => { for (const slide of items || []) { slides.push(slide); visit(slide.children) } }
  visit(presentation?.slides)
  if (Object.hasOwn(link, 'action')) {
    if (!canonicalRunAction(link.action)) throw new TypeError('Invalid run hyperlink action')
    if (link.action?.kind === 'slide' && slides.filter((slide) => slide.id === link.action.slideId).length !== 1)
      return { status: 'unresolved', reason: 'missing-target' }
    return link.action === null ? { status: 'disabled', reason: 'cleared' } : { status: 'ready', action: link.action }
  }
  const references = presentation?.pptxSemantic?.sourceSlides || []
  const matches = references.filter((r) => r.sourceId === link.sourceId && r.partUri === link.targetPartUri)
  if (matches.length !== 1) return { status: 'unresolved', reason: 'source-target-unavailable' }
  if (slides.filter((slide) => slide.id === matches[0].slideId).length !== 1)
    return { status: 'unresolved', reason: 'missing-target' }
  return { status: 'ready', action: { kind: 'slide', slideId: matches[0].slideId } }
}
module.exports = { validateSourceSlides, resolveRunHyperlink }
