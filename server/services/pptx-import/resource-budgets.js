const { MAX_AGGREGATE_MEDIA_BYTES, MAX_PARSED_OUTPUT_BYTES } = require('./constants')
const { PptxImportError } = require('./diagnostics')

function assertParsedOutputBudget(output, maxBytes = MAX_PARSED_OUTPUT_BYTES) {
  const bytes = Buffer.byteLength(JSON.stringify(output))
  if (bytes > maxBytes) {
    throw new PptxImportError('PPTX parsed output byte budget exceeded', {
      status: 413,
      type: 'parsed-output-too-large',
    })
  }
  return bytes
}

function createMediaBudget(maxBytes = MAX_AGGREGATE_MEDIA_BYTES) {
  let usedBytes = 0
  const chargedKeys = new Set()
  return {
    get usedBytes() {
      return usedBytes
    },
    /**
     * Overflow is an ordinary media rejection, not an import failure: the deck
     * still imports, with a placeholder and a warning for whatever did not fit.
     * There is deliberately no throwing variant — one oversized asset must never
     * be able to abort a deck the rest of which imports fine.
     *
     * `contentKey` is optional and exists for callers with no natural dedup
     * point, so one image repeated across slides is charged once. The disk path
     * passes none and does not need one: it charges only after a hash lookup has
     * already proven the content is not stored, so a repeat never reaches the
     * charge at all. The two paths therefore never share a key space, and the
     * keys they would produce are not comparable anyway — one hashes encoded
     * text, the other decoded bytes. Keep it that way; a key that spanned both
     * would have to agree on which of those the budget counts.
     */
    tryReserve(bytes, contentKey) {
      if (contentKey != null && chargedKeys.has(contentKey)) return true
      const size = Number(bytes)
      if (!Number.isSafeInteger(size) || size < 0 || usedBytes + size > maxBytes) return false
      usedBytes += size
      if (contentKey != null) chargedKeys.add(contentKey)
      return true
    },
  }
}

module.exports = { assertParsedOutputBudget, createMediaBudget }
