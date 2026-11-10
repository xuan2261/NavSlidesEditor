// @vitest-environment node
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveSourceFontAssets, SOURCE_FONT_LIMITS } =
  require('../../server/services/pptx-import/source-font-assets')
const request = { faceId: 'main', typeface: 'KaTeX_Main', bold: false, italic: false }
let root, original
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'navslides-font-collection-bounds-'))
  original = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

// All faces share original real font tables; only TTC/SFNT directories are built.
function collection(count = 2, version = 0x00010000) {
  const header = 12 + count * 4 + (version === 0x00020000 ? 12 : 0)
  const directorySize = 12 + original.readUInt16BE(4) * 16
  const size = header + Math.ceil(original.length / 4) * 4 + directorySize * (count - 1)
  const bytes = Buffer.alloc(size)
  bytes.write('ttcf')
  bytes.writeUInt32BE(version, 4)
  bytes.writeUInt32BE(count, 8)
  original.copy(bytes, header)
  for (let i = 0; i < original.readUInt16BE(4); i++) {
    const at = header + 12 + i * 16 + 8
    bytes.writeUInt32BE(bytes.readUInt32BE(at) + header, at)
  }
  for (let i = 0; i < count; i++) {
    const offset = i === 0 ? header : header + Math.ceil(original.length / 4) * 4 + (i - 1) * directorySize
    bytes.writeUInt32BE(offset, 12 + i * 4)
    if (i) bytes.copy(bytes, offset, header, header + directorySize)
  }
  return bytes
}
const resolve = async (bytes) => {
  await writeFile(path.join(root, 'font.ttc'), bytes)
  return resolveSourceFontAssets({ roots: [root], faces: [request] })
}
const first = (b) => b.readUInt32BE(12)
const table = (b, index = 0) => first(b) + 12 + index * 16

describe('strict collection boundaries', () => {
  it.each([
    ['truncated header', (b) => b.subarray(0, 10)],
    ['zero faces', (b) => { b.writeUInt32BE(0, 8) }],
    ['face count bound', (b) => { b.writeUInt32BE(257, 8) }],
    ['truncated offsets', (b) => b.subarray(0, 18)],
    ['unaligned face', (b) => { b.writeUInt32BE(first(b) + 1, 12) }],
    ['out of bounds face', (b) => { b.writeUInt32BE(0xfffffffc, 12) }],
    ['face inside header', (b) => { b.writeUInt32BE(12, 12) }],
    ['duplicate face directory', (b) => { b.writeUInt32BE(first(b), 16) }],
    ['zero tables', (b) => { b.writeUInt16BE(0, first(b) + 4) }],
    ['too many tables', (b) => { b.writeUInt16BE(257, first(b) + 4) }],
    ['truncated directory', (b) => b.subarray(0, first(b) + 28)],
    ['duplicate tag', (b) => { b.writeUInt32BE(b.readUInt32BE(table(b)), table(b, 1)) }],
    ['unaligned table', (b) => { b.writeUInt32BE(b.readUInt32BE(table(b) + 8) + 1, table(b) + 8) }],
    ['table in header', (b) => { b.writeUInt32BE(4, table(b) + 8) }],
    ['table in directory', (b) => { b.writeUInt32BE(first(b), table(b) + 8) }],
    ['out of bounds table', (b) => { b.writeUInt32BE(0xfffffffc, table(b) + 8) }],
    ['out of bounds length', (b) => { b.writeUInt32BE(0xffffffff, table(b) + 12) }],
    ['zero table length', (b) => { b.writeUInt32BE(0, table(b) + 12) }],
    ['partial table overlap', (b) => {
      b.writeUInt32BE(b.readUInt32BE(table(b) + 8) + 4, table(b, 1) + 8)
    }],
    ['inconsistent shared checksum', (b) => {
      const at = b.readUInt32BE(16) + 12 + 4
      b.writeUInt32BE((b.readUInt32BE(at) + 1) >>> 0, at)
    }],
    ['corrupt real table byte', (b) => { b[b.readUInt32BE(table(b) + 8)] ^= 1 }],
    ['malformed unrequested second face', (b) => { b.writeUInt16BE(0, b.readUInt32BE(16) + 4) }],
  ])('rejects %s before delivering any face', async (_, mutate) => {
    const bytes = collection(), changed = mutate(bytes)
    const result = await resolve(Buffer.isBuffer(changed) ? changed : bytes)
    expect(result.assets).toEqual([])
    expect(result.fontProfile.faces).toEqual([])
    expect(result.issues.map((issue) => issue.reason)).toEqual(['font-collection-malformed'])
    expect(result.unresolved).toEqual([{ ...request, reason: 'font-unavailable' }])
  })

  it('reports unsupported collection versions explicitly', async () => {
    const bytes = collection()
    bytes.writeUInt32BE(0x00030000, 4)
    expect((await resolve(bytes)).issues[0].reason).toBe('font-collection-version-unsupported')
  })

  it('does not reinterpret unverified CFF/legacy face signatures as TrueType', async () => {
    const bytes = collection()
    bytes.write('OTTO', first(bytes))
    expect((await resolve(bytes)).issues[0].reason).toBe('font-collection-outline-unsupported')
  })

  it('validates and omits the collection signature directory with private provenance', async () => {
    // A valid empty DSIG directory; no cryptographic signing claim is invented.
    const bytes = Buffer.concat([collection(2, 0x00020000), Buffer.alloc(8)]), at = 20
    bytes.write('DSIG', at)
    bytes.writeUInt32BE(8, at + 4)
    bytes.writeUInt32BE(bytes.length - 8, at + 8)
    bytes.writeUInt32BE(1, bytes.length - 8)
    const result = await resolve(bytes)
    expect(result.issues).toEqual([])
    expect(result.unresolved).toEqual([])
    expect(result.bindings[0].collection.dsigRemoved).toBe(true)
    expect(result.fontProfile.faces[0]).not.toHaveProperty('dsigRemoved')
    bytes.writeUInt16BE(1, bytes.length - 4) // Signature record is absent.
    expect((await resolve(bytes)).issues[0].reason).toBe('font-collection-malformed')
  })

  it('rejects truncated and contradictory version 2 signature fields', async () => {
    const bytes = collection(2, 0x00020000)
    bytes.writeUInt32BE(4, 24)
    expect((await resolve(bytes)).issues[0].reason).toBe('font-collection-malformed')
    expect((await resolve(bytes.subarray(0, 30))).issues[0].reason).toBe('font-collection-malformed')
  })

  it('bounds expanded bytes even when many directories share small input tables', async () => {
    const bytes = collection(256)
    const copies = Math.ceil(SOURCE_FONT_LIMITS.totalBytes / (256 * original.length)) + 2
    for (let i = 0; i < copies; i++) await writeFile(path.join(root, `${i}.ttc`), bytes)
    await expect(resolveSourceFontAssets({ roots: [root], faces: [request] }))
      .rejects.toThrow('extracted total byte budget')
  }, 15000)
})
