// @vitest-environment node
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { resolveSourceFontAssets } = require('../../server/services/pptx-import/source-font-assets')
let root, bytes
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'navslides-font-dsig-'))
  const font = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
  bytes = Buffer.alloc(28 + Math.ceil(font.length / 4) * 4 + 8)
  bytes.write('ttcf')
  bytes.writeUInt32BE(0x00020000, 4)
  bytes.writeUInt32BE(1, 8)
  bytes.writeUInt32BE(28, 12)
  bytes.write('DSIG', 16)
  bytes.writeUInt32BE(8, 20)
  bytes.writeUInt32BE(bytes.length - 8, 24)
  bytes.writeUInt32BE(1, bytes.length - 8) // Version 1, zero signatures/flags.
  font.copy(bytes, 28)
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const at = 28 + 12 + i * 16 + 8
    bytes.writeUInt32BE(bytes.readUInt32BE(at) + 28, at)
  }
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
async function resolve() {
  await writeFile(path.join(root, 'font.ttc'), bytes)
  return resolveSourceFontAssets({ roots: [root], faces: [{
    faceId: 'main', typeface: 'KaTeX_Main', bold: false, italic: false,
  }] })
}

describe('collection digital signature boundaries', () => {
  it.each([
    ['bad version', (b, at) => { b.writeUInt32BE(2, at) }],
    ['reserved flags', (b, at) => { b.writeUInt16BE(2, at + 6) }],
    ['absent record', (b, at) => { b.writeUInt16BE(1, at + 4) }],
    ['unaligned offset', (b, at) => { b.writeUInt32BE(at + 1, 24) }],
    ['out of bounds length', (b) => { b.writeUInt32BE(0xffffffff, 20) }],
    ['directory alias', (b) => { b.writeUInt32BE(28, 24) }],
  ])('rejects %s', async (_, mutate) => {
    mutate(bytes, bytes.readUInt32BE(24))
    const result = await resolve()
    expect(result.assets).toEqual([])
    expect(result.issues[0].reason).toBe('font-collection-malformed')
  })

  it('rejects malformed signature block lengths without treating them as authenticated', async () => {
    const start = bytes.readUInt32BE(24)
    bytes = Buffer.concat([bytes, Buffer.alloc(20)])
    bytes.writeUInt32BE(28, 20)
    bytes.writeUInt16BE(1, start + 4)
    bytes.writeUInt32BE(1, start + 8)
    bytes.writeUInt32BE(8, start + 12)
    bytes.writeUInt32BE(20, start + 16)
    bytes.writeUInt32BE(1, start + 24) // Claims one payload byte outside block.
    expect((await resolve()).issues[0].reason).toBe('font-collection-malformed')
  })

  it('also omits a per-face empty DSIG table and preserves all other table bytes', async () => {
    const count = bytes.readUInt16BE(32), originalDirectory = bytes.subarray(28, 40 + count * 16)
    const offset = bytes.length, directoryLength = 12 + (count + 1) * 16
    bytes = Buffer.concat([bytes, Buffer.alloc(directoryLength + 8)])
    bytes.fill(0, 16, 28) // No collection-level signature directory.
    bytes.writeUInt32BE(offset, 12)
    originalDirectory.copy(bytes, offset, 0, 12)
    bytes.writeUInt16BE(count + 1, offset + 4)
    const selector = Math.floor(Math.log2(count + 1))
    bytes.writeUInt16BE(16 * 2 ** selector, offset + 6)
    bytes.writeUInt16BE(selector, offset + 8)
    bytes.writeUInt16BE((count + 1) * 16 - 16 * 2 ** selector, offset + 10)
    const record = Buffer.alloc(16)
    record.write('DSIG')
    record.writeUInt32BE(1, 4)
    record.writeUInt32BE(offset + directoryLength, 8)
    record.writeUInt32BE(8, 12)
    const records = [record, ...Array.from({ length: count },
      (_, i) => originalDirectory.subarray(12 + i * 16, 28 + i * 16))]
    records.sort((a, b) => a.readUInt32BE(0) - b.readUInt32BE(0))
      .forEach((entry, index) => entry.copy(bytes, offset + 12 + index * 16))
    bytes.writeUInt32BE(1, offset + directoryLength)
    const result = await resolve()
    expect(result.unresolved).toEqual([])
    expect(result.bindings[0].collection.dsigRemoved).toBe(true)
    const delivered = Buffer.from(result.assets[0].bytes)
    expect(delivered.readUInt16BE(4)).toBe(count)
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16
      const tag = delivered.toString('ascii', at, at + 4)
      expect(tag).toBe(originalDirectory.toString('ascii', at, at + 4))
      const start = delivered.readUInt32BE(at + 8), length = delivered.readUInt32BE(at + 12)
      const originalStart = originalDirectory.readUInt32BE(at + 8)
      const actual = Buffer.from(delivered.subarray(start, start + length))
      const expected = Buffer.from(bytes.subarray(originalStart, originalStart + length))
      if (tag === 'head') { actual.writeUInt32BE(0, 8); expected.writeUInt32BE(0, 8) }
      expect(actual).toEqual(expected)
    }
    let sum = 0
    for (let i = 0; i < delivered.length; i += 4) sum = (sum + delivered.readUInt32BE(i)) >>> 0
    expect(sum).toBe(0xb1b0afba)
  })
})
