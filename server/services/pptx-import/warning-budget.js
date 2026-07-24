const { MAX_IMPORT_WARNING_BYTES, MAX_IMPORT_WARNINGS } = require('./constants')

function estimateWarningBytes(warning) {
  try {
    return Buffer.byteLength(JSON.stringify(warning), 'utf8')
  } catch {
    return String(warning?.message || warning || '').length
  }
}

/**
 * Array whose push is hard-capped at accumulate time (count + bytes).
 * Peak length never exceeds maxCount; omitted pushes increment omittedCount.
 */
function createBoundedWarnings({
  maxCount = MAX_IMPORT_WARNINGS,
  maxBytes = MAX_IMPORT_WARNING_BYTES,
} = {}) {
  const warnings = []
  let omittedCount = 0
  let usedBytes = 0

  const originalPush = Array.prototype.push
  warnings.push = function pushImportWarning(...items) {
    let accepted = 0
    for (const item of items) {
      const size = estimateWarningBytes(item)
      if (warnings.length >= maxCount || usedBytes + size > maxBytes) {
        omittedCount += 1
        continue
      }
      originalPush.call(warnings, item)
      usedBytes += size
      accepted += 1
    }
    return accepted
  }

  Object.defineProperty(warnings, 'omittedCount', {
    get() {
      return omittedCount
    },
    enumerable: false,
  })

  return warnings
}

function pushImportWarning(warnings, warning) {
  if (!warnings || typeof warnings.push !== 'function') return false
  const before = warnings.length
  warnings.push(warning)
  return warnings.length > before
}

module.exports = {
  createBoundedWarnings,
  estimateWarningBytes,
  pushImportWarning,
}
