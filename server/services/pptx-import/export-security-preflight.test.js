import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import preflightModule from './export-security-preflight.js'

const { securityPreflight } = preflightModule

async function archive(entries, compression = 'STORE') {
  const zip = new JSZip()
  for (const [name, value] of Object.entries(entries)) zip.file(name, value)
  return zip.generateAsync({ type: 'nodebuffer', compression })
}

function renameEverywhere(bytes, from, to) {
  expect(Buffer.byteLength(from)).toBe(Buffer.byteLength(to))
  const copy = Buffer.from(bytes)
  let offset = 0
  while ((offset = copy.indexOf(from, offset, 'latin1')) >= 0) {
    copy.write(to, offset, 'latin1')
    offset += to.length
  }
  return copy
}

async function expectRawRejection(bytes, limits = {}) {
  const loadZip = vi.fn()
  const result = await securityPreflight(bytes, { loadZip, limits })
  expect(result.ok).toBe(false)
  expect(loadZip).not.toHaveBeenCalled()
}

describe('export security raw ZIP preflight', () => {
  it('rejects highly compressed and oversized archives before JSZip', async () => {
    const bomb = await archive({ 'ppt/a.xml': 'x'.repeat(100_000) }, 'DEFLATE')
    await expectRawRejection(bomb, { maxCompressionRatio: 5 })
    await expectRawRejection(bomb, { maxCompressedBytes: bomb.length - 1 })
  })

  it('rejects central-directory collisions and traversal before JSZip', async () => {
    const two = await archive({ 'ppt/a.xml': 'a', 'ppt/b.xml': 'b' })
    await expectRawRejection(renameEverywhere(two, 'ppt/b.xml', 'ppt/a.xml'))

    const one = await archive({ 'ppt/a.xml': 'a' })
    await expectRawRejection(renameEverywhere(one, 'ppt/a.xml', '../ab.xml'))
  })

  it('rejects unsafe XML before JSZip', async () => {
    const bytes = await archive({ 'ppt/a.xml': '<!DOCTYPE x [<!ENTITY e "x">]><x/>' }, 'DEFLATE')
    await expectRawRejection(bytes)
  })
})
