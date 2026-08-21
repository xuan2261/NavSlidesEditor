const { classifyError, createDiagnosticBuffer, sanitizeError } = require('./package-utils')

describe('package-utils failure classification', () => {
  it('classifies install, import, browser-only, and parse failures', () => {
    expect(classifyError(new Error('Cannot find module pptx'))).toBe('install-failed')
    expect(classifyError(new Error('require() of ES Module is not supported'))).toBe('import-failed')
    expect(classifyError(new Error('window is not defined'))).toBe('browser-only')
    expect(classifyError(new Error('bad zip'))).toBe('parse-failed')
  })

  it('redacts parser diagnostic messages while preserving taxonomy', () => {
    const error = Object.assign(new Error('confidential slide text in parser stack'), {
      type: 'parse-failed',
    })
    const sanitized = sanitizeError(error)

    expect(sanitized.type).toBe('parse-failed')
    expect(sanitized.message).toContain('Diagnostic redacted')
    expect(sanitized.message).not.toContain('confidential slide text')
  })

  it('caps oversized exception diagnostics before hashing', () => {
    const hugePayload = 'x'.repeat(9000)
    const error = Object.assign(new Error(hugePayload), { type: 'parse-failed' })
    const sanitized = sanitizeError(error)

    expect(sanitized.message).toMatch(/\d+ chars/)
    expect(sanitized.message).toContain('capped:8192')
    expect(sanitized.message).not.toContain(hugePayload)
  })

  it('caps diagnostic buffers before sanitization', () => {
    const buffer = createDiagnosticBuffer(8)
    buffer.append('123456')
    buffer.append('7890')

    expect(buffer.toString()).toContain('12345678')
    expect(buffer.toString()).toContain('diagnostic truncated')
    expect(buffer.toString()).not.toContain('90')
  })
})
