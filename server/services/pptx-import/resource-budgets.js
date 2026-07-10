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
  return {
    get usedBytes() {
      return usedBytes
    },
    reserve(bytes) {
      const size = Number(bytes)
      if (!Number.isSafeInteger(size) || size < 0 || usedBytes + size > maxBytes) {
        throw new PptxImportError('PPTX aggregate media budget exceeded', {
          status: 413,
          type: 'media-budget-exceeded',
        })
      }
      usedBytes += size
      return usedBytes
    },
  }
}

module.exports = { assertParsedOutputBudget, createMediaBudget }
