// @vitest-environment node
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = '../../server/services/pptx-import/source-font-assets.js'
const roots = [path.resolve('server/vendor/katex/dist/fonts')]
const face = (overrides = {}) => ({
  faceId: 'main', typeface: 'KaTeX_Main', bold: false, italic: false, ...overrides,
})
const resolve = (input = {}) => require(modulePath).resolveSourceFontAssets({
  roots, faces: [face()], ...input,
})

describe('exact trusted local source font assets', () => {
  it('resolves actual family/style names and hashes the identical authoritative bytes', async () => {
    const original = await readFile(path.join(roots[0], 'KaTeX_Main-Regular.ttf'))
    const result = await resolve()
    expect(result.unresolved).toEqual([])
    expect(result.fontProfile).toEqual({ schemaVersion: 1, faces: [{
      id: 'main', typeface: 'KaTeX_Main', bold: false, italic: false,
      assetHash: createHash('sha256').update(original).digest('hex'),
    }] })
    expect(Buffer.from(result.assets[0].bytes)).toEqual(original)
    expect(result.bindings[0].metadata.families).toContain('KaTeX_Main')
    expect(result.bindings[0].metadata.subfamilies).toContain('Regular')
    const { readFontCoverage } = require('../../shared/src/pptx-text-layout-font.js')
    expect(readFontCoverage(result.assets[0].bytes)('A'.codePointAt(0))).toBe(true)
    const { evaluateFontProfile } = require('../../shared/src/pptx-text-document.js')
    expect(evaluateFontProfile({ profile: result.fontProfile, requests: [{
      typeface: 'KaTeX_Main', bold: false, italic: false, source: { part: 'test', path: 'run' },
    }] }).qualified).toBe(true)
  })

  it('matches declared names case insensitively and rejects contradictory physical style metadata', async () => {
    const result = await resolve({ faces: [
      face({ typeface: 'katex_main' }),
      face({ faceId: 'bold', bold: true }),
      face({ faceId: 'italic', italic: true }),
      face({ faceId: 'both', bold: true, italic: true }),
    ] })
    // These bundled variants declare Bold/Italic subfamilies but also set
    // OS/2 REGULAR (64). Do not erase the contradiction to satisfy a style.
    expect(result.unresolved.map(({ faceId, reason }) => ({ faceId, reason }))).toEqual([
      { faceId: 'bold', reason: 'font-style-unsupported' },
      { faceId: 'italic', reason: 'font-style-unsupported' },
      { faceId: 'both', reason: 'font-style-unsupported' },
    ])
    expect(result.bindings.map((b) => [b.metadata.bold, b.metadata.italic])).toEqual([[false, false]])
    expect(result.fontProfile.faces).toHaveLength(1)
    expect(result.bindings[0].metadata.fsSelection).toBe(64)
    expect(result.fontProfile.faces[0].typeface).toBe('katex_main')
  })

  it('does not use filenames, aliases, paths, missing styles or fallback fonts', async () => {
    const faces = ['KaTeX Main', 'Arial', '../../README.md', 'https://example.org/font.ttf']
      .map((typeface, index) => face({ faceId: `face${index}`, typeface }))
    faces.push(face({ faceId: 'missingStyle', typeface: 'KaTeX_AMS', italic: true }))
    const result = await resolve({ faces })
    expect(result.fontProfile.faces).toEqual([])
    expect(result.assets).toEqual([])
    expect(result.unresolved.map(({ reason }) => reason)).toEqual(faces.map(() => 'font-unavailable'))
  })

  it('snapshots caller provenance separately and returns immutable metadata and defensive bytes', async () => {
    const source = { part: 'ppt/slides/slide1.xml', path: 'rPr' }
    const input = { roots: [...roots], faces: [face({ source })] }
    const pending = resolve(input)
    source.path = 'changed'
    input.faces[0].typeface = 'Arial'
    const result = await pending
    expect(result.bindings[0].source.path).toBe('rPr')
    expect(result.fontProfile.faces[0]).not.toHaveProperty('source')
    expect(Object.isFrozen(result.bindings[0].metadata.families)).toBe(true)
    expect(Object.isFrozen(result.fontProfile.faces[0])).toBe(true)
    const first = result.assets
    new Uint8Array(first[0].bytes).fill(0)
    first.length = 0
    expect(new Uint8Array(result.assets[0].bytes).some((b) => b !== 0)).toBe(true)
  })

  it('deduplicates identical roots/assets without making an exact face ambiguous', async () => {
    const result = await resolve({ roots: [roots[0], roots[0]] })
    expect(result.unresolved).toEqual([])
    expect(result.assets).toHaveLength(1)
  })

  it.each([
    {}, { roots: [], faces: [face()] }, { roots: ['.'], faces: [face()] },
    { roots, faces: [face({ bold: 'false' })] },
    { roots, faces: [face({ italic: undefined })] },
    { roots, faces: [face(), face()] },
    { roots, faces: [face(), face({ faceId: 'duplicateNameStyle' })] },
    { roots, faces: [face({ faceId: '' })] },
    { roots, faces: [face({ typeface: '' })] },
    { roots, faces: [face({ source: { part: 'x' } })] },
    { roots, faces: [face({ extra: true })] },
  ])('rejects invalid explicit configuration %#', async (input) => {
    await expect(require(modulePath).resolveSourceFontAssets(input)).rejects.toThrow(TypeError)
  })

  it('rejects accessor configuration without executing it', async () => {
    let invoked = false
    const input = { roots, get faces() { invoked = true; return [face()] } }
    await expect(require(modulePath).resolveSourceFontAssets(input)).rejects.toThrow(TypeError)
    expect(invoked).toBe(false)
  })

  it('reports missing configured roots as errors rather than probing global font locations', async () => {
    await expect(resolve({ roots: [path.join(roots[0], 'absent-directory')] }))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })
})
