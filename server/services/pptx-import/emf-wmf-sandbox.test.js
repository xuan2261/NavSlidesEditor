import { describe, expect, it } from 'vitest'
import sandbox from './emf-wmf-sandbox.js'

const { convertVectorImage, ALLOWED_BINARIES } = sandbox

describe('emf-wmf-sandbox (Phase 07 policy)', () => {
  it('defaults to disabled conversion (no RCE path)', () => {
    const prev = process.env.PPTX_EMF_CONVERT
    delete process.env.PPTX_EMF_CONVERT
    const result = convertVectorImage('in.emf', 'out.png')
    expect(result.ok).toBe(false)
    expect(result.code).toBe('DISABLED')
    if (prev != null) process.env.PPTX_EMF_CONVERT = prev
  })

  it('allowlists binaries only', () => {
    expect(ALLOWED_BINARIES.has('magick')).toBe(true)
    expect(ALLOWED_BINARIES.has('bash')).toBe(false)
  })
})
