import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import guards from './pptx-guards.js'

const { IMPORT_CRC_POLICY, validatePptxPackage } = guards

async function writeZip(filePath, entries, options = {}) {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(entries)) zip.file(name, content)
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer', ...options }))
}

/** Flip declared CRC fields so payload and CRC disagree (fail-closed regression fixture). */
function corruptZipCrc(bytes) {
  const corrupted = Buffer.from(bytes)
  for (let offset = 0; offset < corrupted.length - 4; offset += 1) {
    if (corrupted.readUInt32LE(offset) === 0x02014b50) {
      corrupted.writeUInt32LE((corrupted.readUInt32LE(offset + 16) + 1) >>> 0, offset + 16)
    }
    if (corrupted.readUInt32LE(offset) === 0x04034b50) {
      corrupted.writeUInt32LE((corrupted.readUInt32LE(offset + 14) + 1) >>> 0, offset + 14)
    }
  }
  return corrupted
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

  it('charges a large non-XML part in full without applying the XML byte cap', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-guards-media-'))
    const file = path.join(dir, 'media.pptx')
    const contentTypes = '<Types />'
    const presentation = '<p:presentation />'
    const media = 'm'.repeat(64 * 1024)
    try {
      await writeZip(file, {
        '[Content_Types].xml': contentTypes,
        'ppt/presentation.xml': presentation,
        'ppt/media/image1.bin': media,
      })
      // Only XML parts are held and inspected, so the XML cap must not reach a
      // media part far larger than it, and that part's bytes must still be
      // charged in full against the decompression budget.
      const result = await validatePptxPackage(file, 'media.pptx', { maxXmlBytes: 1024 })
      expect(result.decompressedBytes).toBe(
        contentTypes.length + presentation.length + media.length,
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('CRC policy is fail-closed with a stable error code (C1)', () => {
    expect(IMPORT_CRC_POLICY).toMatchObject({
      mode: 'fail-closed',
      checkCRC32: true,
      errorCode: 'zip-crc-mismatch',
    })
  })

  it('[cap:import.upload-safety tier:deep] rejects intentional CRC mismatch with zip-crc-mismatch (C1)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-guards-crc-'))
    const file = path.join(dir, 'bad-crc.pptx')
    try {
      const zip = new JSZip()
      zip.file('[Content_Types].xml', '<Types />')
      zip.file('ppt/presentation.xml', '<p:presentation />')
      const good = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
      await fs.writeFile(file, corruptZipCrc(good))

      await expect(validatePptxPackage(file, 'bad-crc.pptx')).rejects.toMatchObject({
        code: 'zip-crc-mismatch',
        reason: 'zip-crc-mismatch',
        status: 400,
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('[cap:import.upload-safety tier:deep] accepts good-CRC packages after CRC gate (C2)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-guards-good-crc-'))
    const file = path.join(dir, 'good-crc.pptx')
    try {
      await writeZip(file, {
        '[Content_Types].xml': '<Types />',
        'ppt/presentation.xml': '<p:presentation />',
      })
      const result = await validatePptxPackage(file, 'good-crc.pptx')
      expect(result.entryCount).toBeGreaterThanOrEqual(2)
      expect(result.decompressedBytes).toBeGreaterThan(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
