import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import exportModule from './server-export.js'

const { exportToFile } = exportModule

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
})
