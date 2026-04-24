import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import path from 'node:path'
import request from 'supertest'
import presentationsRouter from './presentations.js'

describe('PPTX raster API', () => {
  let server
  let baseUrl

  beforeAll(async () => {
    const app = express()
    app.use(express.json({ limit: '50mb' }))
    app.use('/vendor', express.static(path.join(process.cwd(), 'server', 'vendor')))
    app.use('/api/presentations', presentationsRouter)

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve)
    })
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterAll(async () => {
    if (!server) return
    await new Promise((resolve) => server.close(resolve))
  })

  it('rasterizes only HTML embeds and LaTeX elements for hybrid PPTX export', async () => {
    const presentation = {
      title: 'HTML LaTeX PPTX',
      resolution: { width: 960, height: 540 },
      slides: [
        {
          id: 's1',
          background: { type: 'color', color: '#111827' },
          elements: [
            {
              id: 'text-1',
              type: 'text',
              x: 20,
              y: 20,
              width: 160,
              height: 60,
              content: '<p>Editable text</p>',
            },
            {
              id: 'html-1',
              type: 'html',
              x: 40,
              y: 100,
              width: 360,
              height: 220,
              content:
                '<script src="https://cdn.jsdelivr.net/npm/d3@7"></script><svg id="viz" width="360" height="220"></svg><script>d3.select("#viz").append("rect").attr("x",20).attr("y",20).attr("width",180).attr("height",90).attr("fill","#22c55e");</script>',
            },
            {
              id: 'latex-1',
              type: 'latex',
              x: 450,
              y: 100,
              width: 400,
              height: 180,
              content: String.raw`\int_0^\infty e^{-x^2}\,dx=\frac{\sqrt{\pi}}{2}`,
            },
          ],
        },
      ],
    }

    const res = await request(baseUrl).post('/api/presentations/raster-elements').send({ presentation })

    expect(res.status).toBe(200)
    expect(Object.keys(res.body.rasters).sort()).toEqual(['html-1', 'latex-1'])
    expect(res.body.rasters['html-1']).toMatch(/^data:image\/png;base64,/)
    expect(res.body.rasters['latex-1']).toMatch(/^data:image\/png;base64,/)
    expect(res.body.rasters['text-1']).toBeUndefined()
  }, 60000)
})
