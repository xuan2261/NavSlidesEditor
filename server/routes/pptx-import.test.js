import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import routeModule from './pptx-import.js'

const { createPptxImportRouter } = routeModule

async function writeMinimalPptx(filePath) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
}

describe('PPTX import route', () => {
  it('rejects missing file and non-PPTX uploads', async () => {
    const app = express()
    app.use('/api/pptx', createPptxImportRouter({ importer: async () => ({ ok: true }) }))

    const missing = await request(app).post('/api/pptx/import')
    expect(missing.status).toBe(400)

    const pdf = await request(app)
      .post('/api/pptx/import')
      .attach('file', Buffer.from('%PDF'), 'deck.pdf')
    expect(pdf.status).toBe(400)
  })

  it('returns importer output for a valid PPTX upload', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-'))
    const file = path.join(dir, 'valid.pptx')
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use(
        '/api/pptx',
        createPptxImportRouter({
          importer: async () => ({
            presentation: { title: 'valid', theme: 'white', transition: 'slide', slides: [] },
            stats: { parser: 'pptxtojson', fallbackParserUsed: false, slideCount: 0 },
            warnings: [],
          }),
        })
      )

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      expect(res.status).toBe(200)
      expect(res.body.stats.parser).toBe('pptxtojson')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
