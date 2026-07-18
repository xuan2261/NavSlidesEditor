const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024

function assertSafeJson(value, depth = 0) {
  if (depth > 32) throw new Error('OfficeCLI JSON output nesting limit exceeded')
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('OfficeCLI JSON output contains an invalid object')
  }
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) {
      throw new Error('OfficeCLI JSON output contains a prohibited key')
    }
    assertSafeJson(child, depth + 1)
  }
}

function parseBoundedJson(stdout, { maxBytes = DEFAULT_MAX_OUTPUT_BYTES } = {}) {
  if (typeof stdout !== 'string') {
    throw new Error('OfficeCLI JSON output must be text')
  }
  if (Buffer.byteLength(stdout) > maxBytes) {
    throw new Error('OfficeCLI JSON output limit exceeded')
  }
  try {
    const decoded = JSON.parse(stdout)
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('OfficeCLI JSON output must be an object or array')
    }
    assertSafeJson(decoded)
    return decoded
  } catch {
    throw new Error('OfficeCLI JSON output is malformed or truncated')
  }
}

module.exports = { DEFAULT_MAX_OUTPUT_BYTES, parseBoundedJson }
