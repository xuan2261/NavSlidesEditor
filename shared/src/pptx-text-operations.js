const { validateTextHyperlinkOverride } = require('./pptx-text-hyperlink-bindings')
const { normalizeTextDocument } = require('./pptx-text-document.js')
const { semanticInstance, semanticDefinition } = require('./pptx-semantic-records.js')

function canonicalTextReadonly(document, instanceId) {
  let instance = semanticInstance(document, instanceId) ?? document?.instances?.[instanceId]
  if (!instance) return true
  while (instance) {
    if (instance.overrides?.locked || instance.lineage?.tombstone || instance.lineage?.paintOnly)
      return true
    instance = instance.parentInstanceId != null
      ? (semanticInstance(document, instance.parentInstanceId) ?? document?.instances?.[instance.parentInstanceId])
      : null
  }
  return false
}

// Both inline TipTap edits and selection commands must bind the same native body
// to the active occurrence. A compatibility HTML cache is never write authority.
function assertCanonicalTextEdit(document, slide, element, input) {
  const instance = semanticInstance(document, element?.pptxInstanceId) ?? document?.instances?.[element?.pptxInstanceId]
  const definition = instance ? (semanticDefinition(document, instance.definitionId) ?? document?.definitions?.[instance.definitionId]) : null
  const source = definition?.content?.textDocument
  const matches = (slide?.elements || []).filter((candidate) =>
    candidate.id === element?.id && candidate.pptxInstanceId === element?.pptxInstanceId)
  if (!source || !['text', 'shape'].includes(element?.type) ||
      !slide || instance.slideId !== slide.id || matches.length !== 1)
    throw new TypeError('Canonical text requires its source-bound slide occurrence')
  if (slide.locked || element.locked || matches[0].locked || canonicalTextReadonly(document, instance.id))
    throw new TypeError('Inactive or locked text occurrence')
  const textDocument = normalizeTextDocument(input)
  if (textDocument.componentId !== source.componentId)
    throw new TypeError('Canonical text targets a different source body')
  validateTextHyperlinkOverride(definition, textDocument)
  return textDocument
}

module.exports = { assertCanonicalTextEdit, canonicalTextReadonly }
