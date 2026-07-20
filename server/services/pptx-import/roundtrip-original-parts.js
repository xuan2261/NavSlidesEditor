/**
 * Exact original recovery and explicitly selected package revision payloads.
 */
const crypto = require('node:crypto')
const { readOriginalPptx } = require('./original-package')
const { resolveExportStrategy } = require('./roundtrip-policy')

const PPTX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

function payloadError(code, message) {
  return Object.assign(new Error(message), { code, status: 422 })
}

function packagePayload(mode, reason, resolved) {
  if (!resolved || !Buffer.isBuffer(resolved.bytes) || typeof resolved.sha256 !== 'string') {
    throw payloadError('IMMUTABLE_ORIGINAL_CORRUPT', 'Immutable original package bytes are invalid')
  }
  const actual = crypto.createHash('sha256').update(resolved.bytes).digest('hex')
  if (actual !== resolved.sha256) {
    throw payloadError('IMMUTABLE_ORIGINAL_CORRUPT', 'Immutable original package hash verification failed')
  }
  return {
    mode,
    reason,
    buffer: resolved.bytes,
    contentType: PPTX_CONTENT_TYPE,
    byteLength: resolved.bytes.byteLength,
    sha256: actual,
    revisionId: resolved.revisionId,
  }
}

async function resolveLegacyOriginalPayload(presentation) {
  const original = presentation?.pptxOriginal
  if (!original?.id) {
    return {
      mode: 'original-unavailable',
      reason: 'missing-original-id',
      code: 'ORIGINAL_UNAVAILABLE',
      status: 404,
    }
  }
  const buffer = await readOriginalPptx(original.id)
  if (!buffer) {
    return {
      mode: 'original-unavailable',
      reason: 'original-file-missing',
      code: 'ORIGINAL_UNAVAILABLE',
      status: 404,
    }
  }
  const actual = crypto.createHash('sha256').update(buffer).digest('hex')
  if (original.sha256 && actual !== original.sha256) {
    return {
      mode: 'original-unavailable',
      reason: 'original-hash-mismatch',
      code: 'ORIGINAL_HASH_MISMATCH',
      status: 422,
    }
  }
  return {
    mode: 'original-bytes',
    reason: 'legacy-original-bytes',
    buffer,
    contentType: PPTX_CONTENT_TYPE,
    byteLength: buffer.byteLength,
    sha256: actual,
  }
}

/**
 * Resolve only immutable upload/R0 bytes. This must never follow packageRevisionId.
 *
 * @param {object} presentation
 * @param {{ resolveImmutableOriginalRevision?: Function }} [options]
 * @returns {Promise<{ mode: string, reason: string, buffer?: Buffer, contentType?: string }>}
 */
async function resolvePptxOriginalPayload(presentation, options = {}) {
  if (presentation?.pptxAggregateHead) {
    if (typeof options.resolveImmutableOriginalRevision !== 'function') {
      throw payloadError(
        'IMMUTABLE_ORIGINAL_RESOLVER_UNAVAILABLE',
        'Immutable original package resolver is unavailable'
      )
    }
    const resolved = await options.resolveImmutableOriginalRevision({
      presentationId: presentation.id,
    })
    return packagePayload('immutable-package-original', 'authoritative-original-revision', resolved)
  }
  return resolveLegacyOriginalPayload(presentation)
}

/**
 * Resolve a package payload for an explicitly selected edited/validated export path.
 * Normal export and original recovery must use their own explicit route handlers.
 *
 * @param {object} presentation
 * @param {{ forceHybrid?: boolean, edited?: boolean, resolvePackageRevision?: Function }} [options]
 * @returns {Promise<{ mode: string, reason: string, buffer?: Buffer, contentType?: string }>}
 */
async function resolvePptxExportPayload(presentation, options = {}) {
  const strategy = resolveExportStrategy(presentation, options)
  if (strategy.mode === 'package-head') {
    if (typeof options.resolvePackageRevision !== 'function') {
      throw Object.assign(new Error('Authoritative package revision resolver is unavailable'), {
        code: 'PACKAGE_RESOLVER_UNAVAILABLE',
        status: 422,
      })
    }
    const resolved = await options.resolvePackageRevision({
      presentationId: presentation.id,
      revisionId: strategy.revisionId,
    })
    if (!resolved || !Buffer.isBuffer(resolved.bytes) || typeof resolved.sha256 !== 'string') {
      throw Object.assign(new Error('Authoritative package revision bytes are invalid'), {
        code: 'PACKAGE_BLOB_CORRUPT',
        status: 422,
      })
    }
    return {
      mode: 'package-head',
      reason: strategy.reason,
      buffer: resolved.bytes,
      contentType: PPTX_CONTENT_TYPE,
      byteLength: resolved.bytes.byteLength,
      sha256: resolved.sha256,
      revisionId: resolved.revisionId,
    }
  }
  if (strategy.mode !== 'original-bytes') return { mode: strategy.mode, reason: strategy.reason }

  const original = await resolveLegacyOriginalPayload(presentation)
  if (!original.buffer) return { mode: 'hybrid-export', reason: original.reason }
  return original
}

/**
 * Mark presentation dirty after user edits (call from update route optionally).
 */
function markPresentationEdited(presentation) {
  if (!presentation || typeof presentation !== 'object') return presentation
  presentation._pptxEdited = true
  presentation._pptxEditedAt = new Date().toISOString()
  return presentation
}

module.exports = {
  markPresentationEdited,
  resolvePptxExportPayload,
  resolvePptxOriginalPayload,
}
