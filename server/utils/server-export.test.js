import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import exportModule from './server-export.js'
import importerModule from '../services/pptx-import/importer.js'

const { exportToFile } = exportModule
const { importPptxFile } = importerModule

describe('server-export integration', () => {
  it('exports a minimal presentation to a valid pptx file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-export-'))
    const outFile = path.join(tempDir, 'minimal.pptx')

    const presentation = {
      title: 'Test Export',
      resolution: { width: 960, height: 540 },
      slides: [
        {
          id: 's1',
          background: { type: 'color', color: '#111827' },
          elements: [
            {
              id: 't1',
              type: 'text',
              x: 40,
              y: 60,
              width: 360,
              height: 80,
              content: '<strong>Hello</strong> world',
            },
          ],
        },
      ],
    }

    await exportToFile(presentation, outFile, { strictRaster: true })
    const fileBuffer = await fs.readFile(outFile)
    expect(fileBuffer.subarray(0, 2).toString()).toBe('PK')

    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('supports strict gradient background rasterization', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-export-bg-'))
    const outFile = path.join(tempDir, 'gradient.pptx')

    const presentation = {
      title: 'Gradient Export',
      resolution: { width: 960, height: 540 },
      slides: [
        {
          id: 's1',
          background: {
            type: 'gradient',
            gradient: 'linear-gradient(90deg, #111827, #f8fafc)',
          },
          elements: [],
        },
      ],
    }

    await expect(exportToFile(presentation, outFile, { strictRaster: true })).resolves.toBeTruthy()
    await fs.rm(tempDir, { recursive: true, force: true })
  }, 60000)

  it('normalizes and round-trips legacy 4x3 decks using original-size export layout', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-export-4x3-'))
    const outFile = path.join(tempDir, 'roundtrip-4x3.pptx')
    const uploadsDir = path.join(tempDir, 'uploads')

    const presentation = {
      title: '4x3 Roundtrip',
      resolution: { width: 720, height: 540 },
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      slides: [
        {
          id: 's1',
          background: { type: 'color', color: '#ffffff' },
          elements: [
            {
              id: 'center-text',
              type: 'text',
              x: 480,
              y: 270,
              width: 160,
              height: 60,
              content: '<p>Center Marker</p>',
            },
          ],
        },
      ],
    }

    await exportToFile(presentation, outFile, { strictRaster: true })
    const imported = await importPptxFile(outFile, {
      originalName: 'roundtrip-4x3.pptx',
      uploadsDir,
    })

    expect(imported.presentation.resolution).toEqual({ width: 960, height: 540 })
    expect(imported.presentation._pptxMeta?.originalSize).toEqual({ width: 720, height: 540 })

    const marker = imported.presentation.slides[0].elements[0]
    expect(marker).toBeTruthy()
    expect(marker.x / imported.presentation.resolution.width).toBeCloseTo(0.5, 1)
    expect(marker.y / imported.presentation.resolution.height).toBeCloseTo(0.5, 1)

    await fs.rm(tempDir, { recursive: true, force: true })
  }, 60000)

  it('omits hidden elements from PPTX viewer export output', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-export-hidden-'))
    const outFile = path.join(tempDir, 'hidden-elements.pptx')
    const uploadsDir = path.join(tempDir, 'uploads')

    const presentation = {
      title: 'Hidden Export',
      resolution: { width: 960, height: 540 },
      slides: [
        {
          id: 's1',
          background: { type: 'color', color: '#ffffff' },
          elements: [
            {
              id: 'visible-text',
              type: 'text',
              x: 40,
              y: 60,
              width: 360,
              height: 80,
              content: '<p>Visible PPTX marker</p>',
            },
            {
              id: 'hidden-text',
              type: 'text',
              hidden: true,
              x: 40,
              y: 180,
              width: 360,
              height: 80,
              content: '<p>Hidden PPTX marker</p>',
            },
          ],
        },
      ],
    }

    await exportToFile(presentation, outFile, { strictRaster: true })
    const imported = await importPptxFile(outFile, {
      originalName: 'hidden-elements.pptx',
      uploadsDir,
    })

    const content = JSON.stringify(imported.presentation.slides[0].elements).replace(/&nbsp;/g, ' ')
    expect(content).toContain('Visible PPTX marker')
    expect(content).not.toContain('Hidden PPTX marker')

    await fs.rm(tempDir, { recursive: true, force: true })
  }, 60000)
})
