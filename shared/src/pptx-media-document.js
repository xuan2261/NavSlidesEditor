const { safePartUri } = require('./pptx-semantic-family-documents')
const { MEDIA_METADATA_FIELDS, validateMediaMetadataField,
  sourceMediaMetadata } = require('./pptx-media-metadata')
const { semanticInstance, semanticDefinition } = require('./pptx-semantic-records')

const SHA256 = /^[a-f0-9]{64}$/
const UPLOAD = /^\/uploads\/[a-zA-Z0-9/_-]+\.(?:aac|m4a|mov|mp3|mp4|ogg|wav|webm|png|jpe?g|gif|webp|bmp)$/
const fail = (detail) => {
  throw new TypeError(`Invalid PPTX media: ${detail}`)
}
const record = (value, fields, required = fields) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    fail('record fields')
  }
}
const identifier = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 1024

function binding(value, media = false) {
  const fields = media
    ? ['partUri', 'legacyRelationshipId', 'embeddedRelationshipId', 'sha256', 'src']
    : ['partUri', 'relationshipId', 'sha256', 'src']
  record(value, fields)
  if (
    !safePartUri(value.partUri) ||
    !value.partUri.startsWith('ppt/media/') ||
    !fields.filter((field) => field.endsWith('Id')).every((field) => identifier(value[field])) ||
    !SHA256.test(value.sha256) ||
    typeof value.src !== 'string' ||
    !UPLOAD.test(value.src) ||
    value.src.includes('//')
  ) {
    fail('asset binding')
  }
}

function validateMediaDocument(definition) {
  const document = definition.content.mediaDocument
  if (document === undefined) return
  record(document, [
    'schemaVersion',
    'mediaType',
    'legacyComponentId',
    'embeddedComponentId',
    'asset',
    'poster',
    'trim',
  ], [
    'schemaVersion',
    'mediaType',
    'legacyComponentId',
    'embeddedComponentId',
    'asset',
    'poster',
  ])
  if (
    document.schemaVersion !== 1 ||
    !['audio', 'video'].includes(document.mediaType) ||
    definition.kind !== document.mediaType ||
    definition.origin === 'project' ||
    document.legacyComponentId === document.embeddedComponentId
  ) {
    fail('source definition')
  }
  binding(document.asset, true)
  binding(document.poster)
  if (document.asset.src === document.poster.src) fail('asset/poster identity')
  for (const componentId of [document.legacyComponentId, document.embeddedComponentId]) {
    const component = definition.components.find((entry) => entry.id === componentId)
    if (
      !component ||
      component.kind !== 'media-segment' ||
      component.partUri !== undefined ||
      component.locator.preconditionHash !== definition.source.preconditionHash ||
      !Array.isArray(component.locator.path)
    ) {
      fail('source component')
    }
  }
  if (document.trim !== undefined) {
    record(document.trim, ['startMs', 'endMs'], [])
    for (const amount of Object.values(document.trim)) {
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) fail('trim')
    }
  }
}

const MEDIA_PLAYBACK_FIELDS = Object.freeze([
  'startTime', 'endTime', 'playbackRate', 'controls', 'autoplay', 'loop', 'muted',
  ...MEDIA_METADATA_FIELDS,
])

function sourceMediaPlayback(source) {
  return { startTime: (source.trim?.startMs ?? 0) / 1000,
    endTime: (source.trim?.endMs ?? 0) / 1000, playbackRate: 1,
    controls: true, autoplay: false, loop: false, muted: false, ...sourceMediaMetadata(source) }
}

function validateMediaPlayback(source, playback) {
  record(playback, MEDIA_PLAYBACK_FIELDS, [])
  if (!Object.keys(playback).length) fail('empty playback override')
  for (const [key, value] of Object.entries(playback)) {
    if (MEDIA_METADATA_FIELDS.includes(key)) validateMediaMetadataField(key, value)
    else if (['startTime', 'endTime', 'playbackRate'].includes(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
          (key === 'playbackRate' && (value < 0.25 || value > 4))) fail('playback number')
    } else if (typeof value !== 'boolean') fail('playback flag')
  }
  const effective = { ...sourceMediaPlayback(source), ...playback }
  if (effective.endTime !== 0 && effective.endTime <= effective.startTime) fail('playback trim interval')
}

function validateMediaOverride(definition, componentId, override) {
  const source = definition.content.mediaDocument
  const playback = override && Object.hasOwn(override, 'mediaPlayback')
  if (!source || ![source.legacyComponentId, source.embeddedComponentId].includes(componentId)) {
    if (playback) fail('playback targets a foreign source component')
    return false
  }
  if (componentId !== source.embeddedComponentId) fail('playback targets legacy media declaration')
  record(override, ['mediaPlayback'])
  validateMediaPlayback(source, override.mediaPlayback)
  return true
}

function mediaCompatibilityElement(document, element) {
  const instance = semanticInstance(document, element.pptxInstanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  const source = definition?.content.mediaDocument
  if (!source) return element
  const override = instance.overrides.components?.[source.embeddedComponentId]
  if (override) validateMediaOverride(definition, source.embeddedComponentId, override)
  return { ...element, src: source.asset.src, ...sourceMediaPlayback(source), ...override?.mediaPlayback }
}

module.exports = { validateMediaDocument, MEDIA_PLAYBACK_FIELDS, sourceMediaPlayback,
  validateMediaPlayback, validateMediaOverride, mediaCompatibilityElement }
