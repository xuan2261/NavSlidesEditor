import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sandbox from './emf-wmf-sandbox.js'

const { convertVectorImage, ALLOWED_BINARIES, narrowConverterEnv } = sandbox

describe('emf-wmf-sandbox (Phase 07 policy)', () => {
  afterEach(() => {
    delete process.env.PPTX_EMF_CONVERT
    delete process.env.NAVSLIDES_PROBE_SECRET
  })

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

  it('uses a narrow converter env and never spreads full process.env', () => {
    process.env.NAVSLIDES_PROBE_SECRET = 'must-not-leak'
    const env = narrowConverterEnv()
    expect(env.NAVSLIDES_PROBE_SECRET).toBeUndefined()
    expect(env.PATH).toBe(process.env.PATH || '')

    const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'emf-wmf-sandbox.js')
    const source = fs.readFileSync(sourcePath, 'utf8')
    expect(source).not.toContain('...process.env')
    expect(source).toContain('narrowConverterEnv')

    process.env.PPTX_EMF_CONVERT = '1'
    const denied = convertVectorImage('in.emf', 'out.png', { force: true, binary: 'bash' })
    expect(denied.ok).toBe(false)
    expect(denied.code).toBe('POLICY')
  })
})
