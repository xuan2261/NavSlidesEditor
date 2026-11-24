const { sanitizeMediaTrackSrc, TRACK_KINDS, MAX_TRACKS,
  MAX_MEDIA_DESCRIPTION_LENGTH, MAX_TRACK_LABEL_LENGTH,
  MAX_TRACK_LANGUAGE_LENGTH } = require('./media-accessibility')

const MEDIA_METADATA_FIELDS = Object.freeze([
  'poster', 'tracks', 'transcript', 'audioDescription', 'volume',
])
const POSTER = /^\/uploads\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:png|jpe?g|gif|webp|bmp)$/
const TRACK = /^\/uploads\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.vtt$/
const fail = (detail) => { throw new TypeError(`Invalid PPTX media metadata: ${detail}`) }
const bounded = (value, max) => typeof value === 'string' && value.length <= max

function isMediaPoster(value) {
  return typeof value === 'string' && (value === '' || POSTER.test(value))
}

function validTrackSource(src) {
  // Empty tracks are authoring drafts; consumers must not mount them as resources.
  if (src === '') return true
  if (typeof src !== 'string' || sanitizeMediaTrackSrc(src) !== src) return false
  if (src.startsWith('data:')) return true
  if (TRACK.test(src)) return true
  if (!/^https?:\/\//i.test(src) || src.includes('\\')) return false
  try {
    const url = new URL(src)
    return Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}

function validateMediaMetadataField(key, value) {
  if (key === 'poster') {
    if (!isMediaPoster(value)) fail('poster must be an immutable uploaded image path or empty')
  } else if (key === 'volume') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
      fail('volume must be a finite number from 0 to 1')
  } else if (key === 'transcript' || key === 'audioDescription') {
    if (!bounded(value, MAX_MEDIA_DESCRIPTION_LENGTH)) fail('description length or type')
  } else if (key === 'tracks') {
    if (!Array.isArray(value) || value.length > MAX_TRACKS) fail('tracks array')
    let defaults = 0
    for (const track of value) {
      const fields = ['src', 'srcLang', 'label', 'kind', 'default']
      if (!track || typeof track !== 'object' || Array.isArray(track) ||
          Object.keys(track).length !== fields.length || fields.some((field) => !Object.hasOwn(track, field)) ||
          !validTrackSource(track.src) || !bounded(track.srcLang, MAX_TRACK_LANGUAGE_LENGTH) ||
          !bounded(track.label, MAX_TRACK_LABEL_LENGTH) || !TRACK_KINDS.has(track.kind) || typeof track.default !== 'boolean')
        fail('caption track fields or unsafe URL')
      if (track.default && ++defaults > 1) fail('only one default caption track is allowed')
    }
  } else fail('unknown metadata field')
}

function sourceMediaMetadata(source) {
  return { poster: source.poster.src, tracks: [], transcript: '', audioDescription: '', volume: 1 }
}

module.exports = { MEDIA_METADATA_FIELDS, validateMediaMetadataField, sourceMediaMetadata, isMediaPoster }
