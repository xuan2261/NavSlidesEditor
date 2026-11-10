// @vitest-environment node
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveSourceFontAssets } = require('../../server/services/pptx-import/source-font-assets')
const { readFontCoverage } = require('../../shared/src/pptx-text-layout-font')
const { inspectSourceFont } = require('../../server/services/pptx-import/source-font-assets-metadata')
const { evaluateFontProfile } = require('../../shared/src/pptx-text-document')
const hash = (bytes) => createHash('sha256').update(new Uint8Array(bytes)).digest('hex')
const array = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
const align = (n) => Math.ceil(n / 4) * 4
const request = { faceId: 'main', typeface: 'KaTeX_Main', bold: false, italic: false }
let root, regular, ams
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'navslides-font-collection-'))
  regular = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
  ams = await readFile('server/vendor/katex/dist/fonts/KaTeX_AMS-Regular.ttf')
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

// Wrap untouched genuine SFNT tables; only container directory offsets change.
function collection(fonts, version = 0x00010000) {
  let size = 12 + fonts.length * 4 + (version === 0x00020000 ? 12 : 0)
  const offsets = fonts.map((font) => { const at = size; size += align(font.length); return at })
  const result = Buffer.alloc(size)
  result.write('ttcf')
  result.writeUInt32BE(version, 4)
  result.writeUInt32BE(fonts.length, 8)
  fonts.forEach((font, index) => {
    const offset = offsets[index]
    result.writeUInt32BE(offset, 12 + index * 4)
    font.copy(result, offset)
    for (let i = 0; i < font.readUInt16BE(4); i++) {
      const at = offset + 12 + i * 16 + 8
      result.writeUInt32BE(result.readUInt32BE(at) + offset, at)
    }
  })
  return result
}
const resolve = async (bytes, faces = [request], name = 'unrelated.ttc') => {
  await writeFile(path.join(root, name), bytes)
  return resolveSourceFontAssets({ roots: [root], faces })
}
function tables(bytes) {
  const b = Buffer.from(bytes), result = new Map()
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const at = 12 + i * 16, tag = b.toString('ascii', at, at + 4)
    const start = b.readUInt32BE(at + 8), length = b.readUInt32BE(at + 12)
    const content = Buffer.from(b.subarray(start, start + length))
    if (tag === 'head') content.writeUInt32BE(0, 8)
    result.set(tag, content)
  }
  return result
}
function checksum(bytes) {
  const padded = Buffer.alloc(align(bytes.length))
  bytes.copy(padded)
  let sum = 0
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0
  return sum
}

describe('exact physical faces from genuine collection tables', () => {
  it.each([0x00010000, 0x00020000])('extracts the requested second face from TTC version %i', async (version) => {
    const bytes = collection([ams, regular], version)
    const result = await resolve(bytes)
    expect(result.unresolved).toEqual([])
    expect(result.issues).toEqual([])
    const delivered = result.assets[0].bytes
    expect(inspectSourceFont(delivered)).toEqual(inspectSourceFont(array(regular)))
    expect(tables(delivered)).toEqual(tables(regular))
    expect(result.fontProfile.faces[0].assetHash).toBe(hash(delivered))
    expect(result.fontProfile.faces[0].assetHash).not.toBe(hash(array(bytes)))
    expect(result.bindings[0].collection).toEqual({
      version, faceIndex: 1, faceOffset: bytes.readUInt32BE(16), containerHash: hash(array(bytes)),
    })
    expect(Object.isFrozen(result.bindings[0].collection)).toBe(true)
    expect(result.fontProfile.faces[0]).not.toHaveProperty('collection')
    expect(checksum(Buffer.from(delivered))).toBe(0xb1b0afba)
    const covered = readFontCoverage(delivered), original = readFontCoverage(array(regular))
    // Every Unicode scalar is tested by the actual text/table/OMML coverage parser.
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (covered(cp) !== original(cp)) throw new Error(`Coverage changed at ${cp}`)
    }
    expect(evaluateFontProfile({ profile: result.fontProfile, requests: [{
      typeface: request.typeface, bold: false, italic: false, source: { part: 'test', path: 'run' },
    }] }).qualified).toBe(true)
    const data = Buffer.from(delivered)
    for (let i = 0; i < data.readUInt16BE(4); i++) {
      const at = 12 + i * 16, tag = data.toString('ascii', at, at + 4)
      expect(data.readUInt32BE(at + 8) % 4).toBe(0)
      expect(data.readUInt32BE(at + 4)).toBe(checksum(tables(delivered).get(tag)))
    }
    new Uint8Array(delivered).fill(0)
    expect(hash(result.assets[0].bytes)).toBe(result.fontProfile.faces[0].assetHash)
  })

  it('resolves distinct declared families and does not use container filename or first face', async () => {
    const faces = [request, { ...request, faceId: 'ams', typeface: 'katex_ams' },
      { ...request, faceId: 'filename', typeface: 'unrelated' },
      { ...request, faceId: 'missing', typeface: 'Arial' }]
    const result = await resolve(collection([ams, regular]), faces, 'unrelated.otc')
    expect(result.fontProfile.faces.map((f) => f.typeface)).toEqual(['KaTeX_Main', 'katex_ams'])
    expect(result.unresolved.map((f) => f.reason)).toEqual(['font-unavailable', 'font-unavailable'])
    expect(result.bindings.map((b) => b.collection.faceIndex)).toEqual([1, 0])
  })

  it('retains contradictory style rejection within a collection', async () => {
    const bold = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Bold.ttf')
    const result = await resolve(collection([regular, bold]), [{ ...request, bold: true }])
    expect(result.assets).toEqual([])
    expect(result.unresolved[0].reason).toBe('font-style-unsupported')
    expect(result.issues[0]).toMatchObject({ reason: 'font-style-unsupported', faceIndex: 1 })
  })

  it('deduplicates identical faces even when their table bytes are shared', async () => {
    const bytes = collection([regular, regular])
    const first = bytes.readUInt32BE(12), second = bytes.readUInt32BE(16)
    for (let i = 0; i < regular.readUInt16BE(4); i++) {
      const at = 12 + i * 16 + 8
      bytes.writeUInt32BE(bytes.readUInt32BE(first + at), second + at)
    }
    const result = await resolve(bytes)
    expect(result.unresolved).toEqual([])
    expect(result.assets).toHaveLength(1)
  })

  it('keeps ambiguity based on delivered hashes across standalone and collection candidates', async () => {
    const bytes = collection([ams, regular])
    const extracted = await resolve(bytes)
    // Legal trailing padding changes asset identity, never names/glyphs/metrics.
    await writeFile(path.join(root, 'also-main.ttf'),
      Buffer.concat([Buffer.from(extracted.assets[0].bytes), Buffer.alloc(4)]))
    const result = await resolve(bytes)
    expect(result.assets).toEqual([])
    expect(result.unresolved).toEqual([{ ...request, reason: 'font-ambiguous' }])
  })
})
