import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import guards from './pptx-guards.js'

const { validatePptxPackage } = guards

async function writeZip(filePath, entries) {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(entries)) zip.file(name, content)
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
}

describe('pptx package guards', () => {
  it('accepts a minimal PPTX package shape', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-guards-'))
    const file = path.join(dir, 'valid.pptx')
    try {
      await writeZip(file, {
        '[Content_Types].xml': '<Types />',
        'ppt/presentation.xml': '<p:presentation />',
      })
      const result = await validatePptxPackage(file, 'valid.pptx')
      expect(result.entryCount).toBeGreaterThanOrEqual(2)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('[cap:import.upload-safety tier:deep] rejects non-PPTX names, renamed non-ZIPs, and missing required entries', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-guards-'))
    try {
      const renamed = path.join(dir, 'renamed.pptx')
      await fs.writeFile(renamed, 'not a zip')
      await expect(validatePptxPackage(renamed, 'file.pdf')).rejects.toThrow(/Only .pptx/)
      await expect(validatePptxPackage(renamed, 'renamed.pptx')).rejects.toThrow(/not a ZIP/)

      const incomplete = path.join(dir, 'incomplete.pptx')
      await writeZip(incomplete, { '[Content_Types].xml': '<Types />' })
      await expect(validatePptxPackage(incomplete, 'incomplete.pptx')).rejects.toThrow(/required PPTX/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('[cap:import.upload-safety tier:deep] rejects packages over the decompression budget', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-guards-'))
    const file = path.join(dir, 'large.pptx')
    try {
      await writeZip(file, {
        '[Content_Types].xml': '<Types />',
        'ppt/presentation.xml': '<p:presentation />',
        'ppt/media/image1.bin': '1234567890',
      })
      await expect(
        validatePptxPackage(file, 'large.pptx', { maxDecompressedBytes: 5 })
      ).rejects.toThrow(/decompression budget/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
