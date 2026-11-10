// @vitest-environment node
import { createRequire } from 'node:module'
import { appendFile, copyFile, mkdir, mkdtemp, realpath, rm, symlink, truncate } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveSourceFontAssets, SOURCE_FONT_LIMITS } =
  require('../../server/services/pptx-import/source-font-assets.js')
const bundled = path.resolve('server/vendor/katex/dist/fonts')
const request = { faceId: 'main', typeface: 'KaTeX_Main', bold: false, italic: false }
let temporary, root
beforeEach(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), 'navslides-source-font-'))
  root = path.join(temporary, 'trusted')
  await mkdir(root)
})
afterEach(async () => { await rm(temporary, { recursive: true, force: true }) })
const copyRegular = (name) => copyFile(
  path.join(bundled, 'KaTeX_Main-Regular.ttf'), path.join(root, name),
)
const resolve = (faces = [request], roots = [root]) => resolveSourceFontAssets({ roots, faces })

describe('bounded exact source font inventory', () => {
  it('uses actual declared names when the asset filename is unrelated', async () => {
    await copyRegular('unrelated-physical-file.ttf')
    const result = await resolve([
      request, { ...request, faceId: 'full', typeface: 'KaTeX_Main-Regular' },
      { ...request, faceId: 'filename', typeface: 'unrelated-physical-file' },
    ])
    expect(result.fontProfile.faces.map((f) => f.id)).toEqual(['main', 'full'])
    expect(result.fontProfile.faces[0].assetHash).toBe(result.fontProfile.faces[1].assetHash)
    expect(result.unresolved).toEqual([{
      ...request, faceId: 'filename', typeface: 'unrelated-physical-file', reason: 'font-unavailable',
    }])
  })

  it('deduplicates byte-identical files by real hash', async () => {
    await copyRegular('one.ttf')
    await copyRegular('two.ttf')
    expect((await resolve()).unresolved).toEqual([])
  })

  it('rejects distinct physical assets declaring the same exact identity as ambiguous', async () => {
    await copyRegular('one.ttf')
    await copyRegular('two.ttf')
    // A legal trailing SFNT padding word preserves every actual glyph/name
    // table but makes this a distinct byte asset. Neither hash is manufactured.
    await appendFile(path.join(root, 'two.ttf'), new Uint8Array(4))
    const result = await resolve()
    expect(result.unresolved).toEqual([{ ...request, reason: 'font-ambiguous' }])
    expect(result.fontProfile.faces).toEqual([])
    expect(result.assets).toEqual([])
  })

  it('does not synthesize a missing bold or italic face from a regular asset', async () => {
    await copyRegular('looks-bold-italic.ttf')
    const faces = [{ ...request, bold: true }, { ...request, faceId: 'italic', italic: true }]
    const result = await resolve(faces)
    expect(result.unresolved).toEqual(faces.map((face) => ({ ...face, reason: 'font-unavailable' })))
  })

  it('reports real unsupported WOFF inventory without converting or substituting it', async () => {
    await copyFile(path.join(bundled, 'KaTeX_Main-Regular.woff'), path.join(root, 'font.woff'))
    const result = await resolve()
    expect(result.issues).toEqual([{
      path: await realpath(path.join(root, 'font.woff')), reason: 'font-container-unsupported',
    }])
    expect(result.unresolved).toEqual([{ ...request, reason: 'font-unavailable' }])
    expect(result.assets).toEqual([])
  })

  it('reports malformed inventory explicitly without borrowing another identity', async () => {
    await copyFile(path.resolve('README.md'), path.join(root, 'not-a-font.ttf'))
    const result = await resolve()
    expect(result.issues[0].reason).toBe('font-container-unsupported')
    expect(result.unresolved[0].reason).toBe('font-unavailable')
  })

  it('does not follow directory symlinks/junctions outside an explicitly trusted root', async () => {
    const outside = path.join(temporary, 'not-configured')
    await mkdir(outside)
    await copyFile(path.join(bundled, 'KaTeX_Main-Regular.ttf'), path.join(outside, 'font.ttf'))
    await symlink(outside, path.join(root, 'escape'), 'junction')
    expect((await resolve()).unresolved).toEqual([{ ...request, reason: 'font-unavailable' }])
  })

  it('rejects an oversized asset before allocating or hashing its bytes', async () => {
    await copyRegular('huge.ttf')
    await truncate(path.join(root, 'huge.ttf'), SOURCE_FONT_LIMITS.assetBytes + 1)
    await expect(resolve()).rejects.toThrow('asset byte budget')
  })

  it('rejects over-deep inventories instead of silently missing files', async () => {
    await mkdir(path.join(root, ...Array.from({ length: SOURCE_FONT_LIMITS.depth + 1 }, () => 'nested')),
      { recursive: true })
    await expect(resolve()).rejects.toThrow('directory depth budget')
  })
})
