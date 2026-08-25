const { isSafeHref } = require('./content-safety.js')

const ACTION_KINDS = new Set(['url', 'slide', 'next', 'previous', 'first', 'last', 'email', 'download'])
const NAVIGATION_KINDS = new Set(['next', 'previous', 'first', 'last'])
const URL_KINDS = new Set(['url', 'email', 'download'])
function hasControlChars(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

function safeText(value, max = 240) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return !text || hasControlChars(text) ? '' : text.slice(0, max)
}

function isSafeActionUrl(value, kind) {
  if (!isSafeHref(value)) return false
  try {
    const protocol = new URL(value, 'https://navslides.local').protocol
    if (kind === 'email') return protocol === 'mailto:'
    return protocol === 'http:' || protocol === 'https:' || String(value).startsWith('/') || String(value).startsWith('./') || String(value).startsWith('../')
  } catch {
    return false
  }
}

/** Normalize untrusted persisted action metadata without mutating it. */
function normalizeElementAction(value) {
  if (value == null) return { action: null, error: '' }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { action: null, error: 'Action must be an object.' }
  const kind = safeText(value.kind, 24)
  if (!ACTION_KINDS.has(kind)) return { action: null, error: 'Choose a supported action kind.' }
  const allowed = new Set(['kind', 'label', 'hotspot'])
  if (kind === 'slide') allowed.add('slideId')
  if (URL_KINDS.has(kind)) { allowed.add('url'); allowed.add('target') }
  if (Object.keys(value).some((key) => !allowed.has(key))) return { action: null, error: 'Action contains unsupported fields.' }

  const label = safeText(value.label)
  const hotspot = value.hotspot === true
  const target = value.target === 'new' ? 'new' : 'same'
  if (value.target != null && target !== value.target) return { action: null, error: 'Choose a supported action target.' }
  if (NAVIGATION_KINDS.has(kind)) {
    return { action: { kind, ...(label ? { label } : {}), ...(hotspot ? { hotspot: true } : {}) }, error: '' }
  }
  if (kind === 'slide') {
    const slideId = safeText(value.slideId, 160)
    return slideId
      ? { action: { kind, slideId, ...(label ? { label } : {}), ...(hotspot ? { hotspot: true } : {}) }, error: '' }
      : { action: null, error: 'Choose a destination slide.' }
  }
  const url = safeText(value.url, 2048)
  if (!isSafeActionUrl(url, kind)) return { action: null, error: `Enter a safe ${kind === 'email' ? 'mailto' : 'HTTP(S) or project-relative'} URL.` }
  return { action: { kind, url, ...(target === 'new' ? { target } : {}), ...(label ? { label } : {}), ...(hotspot ? { hotspot: true } : {}) }, error: '' }
}

function serializeElementAction(value) {
  const { action } = normalizeElementAction(value)
  return action ? JSON.stringify(action).replace(/</g, '\\u003c') : ''
}

module.exports = { ACTION_KINDS, URL_KINDS, normalizeElementAction, serializeElementAction }
