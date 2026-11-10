const { cloneTextData } = require('./pptx-text-document')
const { sourceMediaPlayback, validateMediaOverride } = require('./pptx-media-document')
const { semanticInstance, semanticDefinition, replaceSemanticRecords } = require('./pptx-semantic-records')
const MEDIA_EDIT = 'media.edit'
const fail = (detail) => { throw new TypeError(`Invalid PPTX media playback: ${detail}`) }

function mediaOperationAvailable(document, instanceId) {
  let instance = semanticInstance(document, instanceId)
  if (!semanticDefinition(document, instance?.definitionId)?.content.mediaDocument) return false
  const seen = new Set()
  while (instance) {
    if (seen.has(instance.id) || instance.overrides.locked || instance.lineage?.tombstone || instance.lineage?.paintOnly)
      return false
    seen.add(instance.id)
    const parentId = instance.parentInstanceId
    instance = semanticInstance(document, parentId)
    if (parentId != null && !instance) return false
  }
  return true
}

function editMediaPlaybackOccurrence(document, instanceId, componentId, input) {
  let patch
  try { patch = cloneTextData(input) } catch { fail('plain finite playback data required') }
  const instance = semanticInstance(document, instanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  if (!mediaOperationAvailable(document, instanceId) ||
      componentId !== definition.content.mediaDocument.embeddedComponentId) fail('unavailable or foreign component')
  const components = { ...instance.overrides.components }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length)
    fail('nonempty playback patch required')
  const source = definition.content.mediaDocument
  const playback = { ...components[componentId]?.mediaPlayback, ...patch }
  validateMediaOverride(definition, componentId, { mediaPlayback: playback })
  const baseline = sourceMediaPlayback(source)
  for (const key of Object.keys(playback)) {
    if (playback[key] === baseline[key] || (key === 'tracks' && playback.tracks.length === 0))
      delete playback[key]
  }
  if (Object.keys(playback).length) components[componentId] = { mediaPlayback: playback }
  else delete components[componentId]
  const overrides = { ...instance.overrides }
  if (Object.keys(components).length) overrides.components = components
  else delete overrides.components
  return replaceSemanticRecords(document, { instances: { [instanceId]: { ...instance, overrides } } })
}

function applyMediaPresentationOperation(input, intent) {
  const { normalizeSemanticPresentation } = require('./pptx-semantic-presentation')
  const operation = cloneTextData(intent)
  if (!operation || Object.keys(operation).length !== 4 ||
      !['type', 'instanceId', 'componentId', 'command'].every((key) => Object.hasOwn(operation, key)) ||
      operation.type !== MEDIA_EDIT || operation.command?.type !== 'set-playback' ||
      Object.keys(operation.command).length !== 2 || !Object.hasOwn(operation.command, 'playback'))
    fail('operation envelope')
  const presentation = normalizeSemanticPresentation(input)
  let matched = false
  function check(slides, ancestorLocked = false) {
    for (const slide of slides) {
      const locked = ancestorLocked || slide.locked
      for (const element of slide.elements || []) if (element.pptxInstanceId === operation.instanceId) {
        if (matched || locked || element.locked) fail('locked or ambiguous target')
        matched = true
      }
      check(slide.children || [], locked)
    }
  }
  check(presentation.slides)
  if (!matched) fail('missing target')
  const document = editMediaPlaybackOccurrence(presentation.pptxSemantic,
    operation.instanceId, operation.componentId, operation.command.playback)
  return normalizeSemanticPresentation({ ...presentation, pptxSemantic: document })
}

module.exports = { MEDIA_EDIT, mediaOperationAvailable, editMediaPlaybackOccurrence,
  applyMediaPresentationOperation }
