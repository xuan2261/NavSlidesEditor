import { afterEach, describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sandbox from './emf-wmf-sandbox.js'

const { convertVectorImage, resolveConverterBinary, ALLOWED_BINARIES, narrowConverterEnv } = sandbox

describe('EMF/WMF converter policy', () => {
  afterEach(() => {
    delete process.env.PPTX_EMF_CONVERT
    delete process.env.NAVSLIDES_PROBE_SECRET
  })

  it('defaults to disabled conversion (no RCE path)', async () => {
    const prev = process.env.PPTX_EMF_CONVERT
    delete process.env.PPTX_EMF_CONVERT
    const result = await convertVectorImage('in.emf', 'out.png')
    expect(result.ok).toBe(false)
    expect(result.code).toBe('DISABLED')
    if (prev != null) process.env.PPTX_EMF_CONVERT = prev
  })

  it('allowlists binaries only', () => {
    expect(ALLOWED_BINARIES.has('magick')).toBe(true)
    expect(ALLOWED_BINARIES.has('bash')).toBe(false)
  })

  it('uses a narrow converter env and never spreads full process.env', async () => {
    process.env.NAVSLIDES_PROBE_SECRET = 'must-not-leak'
    const env = narrowConverterEnv()
    expect(env.NAVSLIDES_PROBE_SECRET).toBeUndefined()
    expect(env.PATH).toBe(process.env.PATH || '')

    const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'emf-wmf-sandbox.js')
    const source = fs.readFileSync(sourcePath, 'utf8')
    expect(source).not.toContain('...process.env')
    expect(source).toContain('narrowConverterEnv')

    process.env.PPTX_EMF_CONVERT = '1'
    const denied = await convertVectorImage('in.emf', 'out.png', { force: true, binary: 'bash' })
    expect(denied.ok).toBe(false)
    expect(denied.code).toBe('POLICY')
  })

  it('rejects bare PATH binary names even for an allowlisted converter', async () => {
    process.env.PPTX_EMF_CONVERT = '1'
    // No opt-in exists: a bare name resolves through PATH, so an attacker who can
    // write anywhere on PATH picks the converter. Absolute paths only, always.
    const result = await convertVectorImage('in.emf', 'out.png', { force: true, binary: 'magick' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('emf-binary-must-be-absolute')
  })

  it('rejects a relative trusted root before filesystem resolution', () => {
    const result = resolveConverterBinary({
      binary: path.join(os.tmpdir(), 'magick.exe'),
      trustedRoot: 'relative/trusted-root',
      sha256: 'a'.repeat(64),
    })
    expect(result).toMatchObject({
      ok: false,
      error: 'emf-binary-root-must-be-absolute',
      code: 'POLICY',
    })
  })

  it('requires a regular hash-pinned binary inside the configured root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-emf-root-'))
    try {
      const binary = path.join(root, 'magick.exe')
      const bytes = Buffer.from('trusted converter')
      fs.writeFileSync(binary, bytes)
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
      expect(resolveConverterBinary({ binary, trustedRoot: root, sha256 })).toEqual({
        ok: true,
        binary: fs.realpathSync.native(binary),
        sha256,
      })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['missing', (root) => path.join(root, 'magick.exe'), 'emf-binary-not-found'],
    ['directory', (root) => path.join(root, 'magick.exe'), 'emf-binary-file-invalid'],
  ])('fails closed for a %s converter path', (_label, getBinary, error) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-emf-root-'))
    if (_label === 'directory') fs.mkdirSync(getBinary(root))
    try {
      const result = resolveConverterBinary({
        binary: getBinary(root),
        trustedRoot: root,
        sha256: 'a'.repeat(64),
      })
      expect(result).toMatchObject({ ok: false, error, code: 'POLICY' })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  // The policy pins name, hash, and containment — nothing else — so a pinned copy
  // of this Node binary is an allowlisted converter that runs the input path as
  // its script. That is how these tests reach the spawn at all.
  async function withPinnedConverter(body, scriptSource) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-emf-spawn-'))
    try {
      const binary = path.join(root, process.platform === 'win32' ? 'magick.exe' : 'magick')
      fs.copyFileSync(process.execPath, binary)
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex')
      const script = path.join(root, 'converter-script.js')
      fs.writeFileSync(script, scriptSource)
      return await body({
        script,
        output: path.join(root, 'out.png'),
        options: { force: true, binary, trustedRoot: root, sha256 },
      })
    } finally {
      // Windows refuses to unlink an executable whose handle the OS has not yet
      // released after the child dies, which a killed converter makes likely.
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 })
    }
  }

  it('keeps the event loop running while the converter child works', async () =>
    withPinnedConverter(async ({ script, output, options }) => {
      let ticked = false
      const pending = convertVectorImage(script, output, options)
      setTimeout(() => { ticked = true }, 20)
      const result = await pending

      expect(result).toMatchObject({ ok: true, outPath: output })
      expect(ticked).toBe(true)
    }, "setTimeout(() => require('fs').writeFileSync(process.argv[2], 'png'), 200)"))

  it('survives a converter that floods stdout', async () =>
    withPinnedConverter(async ({ script, output, options }) => {
      // Nothing reads the child's stdout, so an undrained pipe fills, the child
      // blocks forever on write, and the timeout kills a conversion that worked.
      // 256KB clears the pipe buffer on every platform (Linux is 64KB).
      const result = await convertVectorImage(script, output, { ...options, timeoutMs: 5_000 })
      expect(result).toMatchObject({ ok: true, outPath: output })
    }, [
      "process.stdout.write('progress '.repeat(26214))",
      "require('fs').writeFileSync(process.argv[2], 'png')",
    ].join('\n')))

  it('reports a converter that outlives its timeout as killed', async () =>
    withPinnedConverter(async ({ script, output, options }) => {
      const result = await convertVectorImage(script, output, { ...options, timeoutMs: 300 })
      expect(result.ok).toBe(false)
      expect(result.code).toBe('CONVERT_FAILED')
      expect(result.error).toMatch(/^convert-killed-/)
    }, 'setTimeout(() => {}, 30000)'))

  it('surfaces converter stderr when the child exits non-zero', async () =>
    withPinnedConverter(async ({ script, output, options }) => {
      const result = await convertVectorImage(script, output, options)
      expect(result).toMatchObject({ ok: false, code: 'CONVERT_FAILED' })
      expect(result.error).toContain('unsupported EMF record')
    }, [
      "process.stderr.write('unsupported EMF record\\n')",
      'setTimeout(() => process.exit(3), 50)',
    ].join('\n')))

  it('bounds retained stderr and decodes it without splitting multibyte text', async () =>
    withPinnedConverter(async ({ script, output, options }) => {
      const result = await convertVectorImage(script, output, options)
      expect(result.ok).toBe(false)
      // Bounded regardless of how the converter chunks its output, and never
      // rendered as replacement characters by a split UTF-8 sequence.
      expect(result.error.length).toBeLessThanOrEqual(8 * 1024)
      expect(result.error).not.toContain('�')
      expect(result.error).toContain('é')
    }, [
      "process.stderr.write('é'.repeat(40000))",
      'setTimeout(() => process.exit(3), 50)',
    ].join('\n')))

  it('returns a failure result instead of throwing when the spawn itself is rejected', async () =>
    withPinnedConverter(async ({ script, output, options }) => {
      // map-image.js awaits this with no try/catch and branches on `.ok`, so a
      // synchronous throw here would fail a whole deck over one bad image.
      const result = await convertVectorImage(script, output, { ...options, signal: 'not-a-signal' })
      expect(result).toMatchObject({ ok: false, code: 'CONVERT_FAILED' })
    }, "require('fs').writeFileSync(process.argv[2], 'png')"))

  it('kills the converter child when the import is aborted', async () =>
    withPinnedConverter(async ({ script, output, options }) => {
      const controller = new AbortController()
      const pending = convertVectorImage(script, output, {
        ...options,
        signal: controller.signal,
        timeoutMs: 30_000,
      })
      setTimeout(() => controller.abort(), 50)
      const result = await pending

      // Cancelling an import must not leave a 30s converter running per image.
      expect(result.ok).toBe(false)
      expect(result.code).toBe('CONVERT_FAILED')
    }, 'setTimeout(() => {}, 30000)'))

  it('rejects root-prefix escapes and hash mismatches before spawn', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-emf-parent-'))
    const root = path.join(parent, 'trusted')
    const sibling = path.join(parent, 'trusted-copy')
    fs.mkdirSync(root)
    fs.mkdirSync(sibling)
    try {
      const binary = path.join(sibling, 'magick.exe')
      fs.writeFileSync(binary, 'untrusted')
      expect(resolveConverterBinary({
        binary,
        trustedRoot: root,
        sha256: 'a'.repeat(64),
      })).toMatchObject({ ok: false, error: 'emf-binary-outside-root', code: 'POLICY' })

      const trustedBinary = path.join(root, 'magick.exe')
      fs.writeFileSync(trustedBinary, 'trusted')
      expect(resolveConverterBinary({
        binary: trustedBinary,
        trustedRoot: root,
        sha256: 'a'.repeat(64),
      })).toMatchObject({ ok: false, error: 'emf-binary-hash-mismatch', code: 'POLICY' })
    } finally {
      fs.rmSync(parent, { recursive: true, force: true })
    }
  })
})
