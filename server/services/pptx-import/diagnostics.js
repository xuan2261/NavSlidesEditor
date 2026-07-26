const { FAILURE_TYPES } = require('./constants')

class PptxImportError extends Error {
  constructor(message, { status = 400, type = FAILURE_TYPES.parseFailed } = {}) {
    super(message)
    this.name = 'PptxImportError'
    this.status = status
    this.type = type
  }
}

function sanitizeDiagnostic(value, maxLength = 500) {
  const raw =
    typeof value === 'string'
      ? value
      : value?.message || value?.error || JSON.stringify(value || 'PPTX import failed')

  return String(raw)
    .replace(/<[^>]{1,200}>/g, '[xml]')
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, '[data]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[email]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function classifyError(err) {
  // Preserve explicit failure types set by upstream guards (e.g. output-empty).
  const explicit = err?.type
  if (typeof explicit === 'string' && Object.values(FAILURE_TYPES).includes(explicit)) {
    return explicit
  }
  const message = `${err?.message || err || ''}`.toLowerCase()
  if (message.includes('cannot find module') || message.includes('module not found')) {
    return FAILURE_TYPES.installFailed
  }
  if (message.includes('window is not defined') || message.includes('document is not defined')) {
    return FAILURE_TYPES.browserOnly
  }
  if (message.includes('import') || message.includes('require')) {
    return FAILURE_TYPES.importFailed
  }
  return FAILURE_TYPES.parseFailed
}

module.exports = {
  PptxImportError,
  classifyError,
  sanitizeDiagnostic,
}
