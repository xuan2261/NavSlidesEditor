import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import guards from './pptx-guards.js'

const { validatePptxPackage } = guards

async function writeRequiredZip(filePath, extraEntries = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  for (const [name, content] of Object.entries(extraEntries)) zip.file(name, content)
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await fs.writeFile(filePath, buf)
  return buf
}

describe('zip-bomb guard — measured inflation, not declared size', () => {
  it('[cap:import.upload-safety tier:deep] rejects a highly compressible XML part bomb based on MEASURED inflated bytes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-zipbomb-'))
    const file = path.join(dir, 'bomb.pptx')
    try {
      // ~4MB of repeated bytes: compresses to a few KB on disk but inflates large.
      const bigXml = '<x>' + 'A'.repeat(4 * 1024 * 1024) + '</x>'
      await writeRequiredZip(file, { 'ppt/slides/slide1.xml': bigXml })
      // Tiny cumulative cap forces the MEASURED check to fire even if the
      // declared-size fast-reject were bypassed.
      await expect(
        validatePptxPackage(file, 'bomb.pptx', { maxDecompressedBytes: 64 * 1024 })
      ).rejects.toThrow(/decompression budget/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('[cap:import.upload-safety tier:deep] rejects a compressible media part bomb', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-zipbomb-media-'))
    const file = path.join(dir, 'media-bomb.pptx')
    try {
      const zeros = Buffer.alloc(4 * 1024 * 1024, 0)
      await writeRequiredZip(file, { 'ppt/media/image1.bin': zeros })
      await expect(
        validatePptxPackage(file, 'media-bomb.pptx', { maxDecompressedBytes: 64 * 1024 })
      ).rejects.toThrow(/decompression budget/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('[cap:import.upload-safety tier:deep] still accepts a small legit package within budget', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-zipbomb-ok-'))
    const file = path.join(dir, 'ok.pptx')
    try {
      await writeRequiredZip(file, { 'ppt/slides/slide1.xml': '<x>hello</x>' })
      const result = await validatePptxPackage(file, 'ok.pptx', { maxDecompressedBytes: 1024 * 1024 })
      expect(result.entryCount).toBeGreaterThanOrEqual(3)
      expect(result.decompressedBytes).toBeGreaterThan(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('parser worker heap cap', () => {
  it('appends a --max-old-space-size cap so a parser OOM kills the worker, not the host', async () => {
    const runner = await import('./worker-runner.js')
    const { buildParserExecArgv } = runner.default
    const argv = buildParserExecArgv([])
    expect(argv.some((a) => /^--max-old-space-size=\d+$/.test(a))).toBe(true)
  })
})
