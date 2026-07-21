import { beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import fs from 'fs-extra'
import express from 'express'
import { openPackageStore } from '../services/pptx-import/package-store/index.js'
import * as storage from '../services/storage.js'
import templatesRouter from './templates.js'

const app = express()
app.use(express.json())
app.use('/api/templates', templatesRouter)

describe('Templates API', () => {
  beforeAll(() => {
    storage.initDataFiles()
  })

  it('creates, lists, reads, updates, and deletes custom templates', async () => {
    const createRes = await request(app)
      .post('/api/templates')
      .send({
        title: `Template ${Date.now()}`,
        theme: 'moon',
        transition: 'zoom',
        slides: [{ id: 's1', speakerNotes: 'Template note', elements: [] }],
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.isTemplate).toBe(true)
    expect(createRes.body.slides[0].notes).toBe('Template note')
    const id = createRes.body.id

    const listRes = await request(app).get('/api/templates')
    expect(listRes.status).toBe(200)
    expect(listRes.body.some((item) => item.id === id && item.slideCount === 1)).toBe(true)

    const getRes = await request(app).get(`/api/templates/${id}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.id).toBe(id)

    await storage.withTemplates((templates) => {
      const template = templates.find((item) => item.id === id)
      template.pptxAggregateHead = { packageRevisionId: 'server-owned-revision' }
    })
    const updateRes = await request(app).put(`/api/templates/${id}`).send({ title: 'Updated Template' })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.title).toBe('Updated Template')
    expect(updateRes.body).not.toHaveProperty('pptxAggregateHead')

    const contentUpdateRes = await request(app)
      .put(`/api/templates/${id}`)
      .send({ slides: [{ id: 's2', elements: [] }] })
    expect(contentUpdateRes).toMatchObject({
      status: 422,
      body: { code: 'PACKAGE_TEMPLATE_PROJECTION_IMMUTABLE' },
    })

    const deleteRes = await request(app).delete(`/api/templates/${id}`)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.success).toBe(true)

    expect((await request(app).get(`/api/templates/${id}`)).status).toBe(404)
  })

  it('leaves the template JSON intact when package owner release is unavailable', async () => {
    const created = await request(app)
      .post('/api/templates')
      .send({
        title: `Release failure ${Date.now()}`,
        slides: [{ id: 'release-failure-slide', elements: [] }],
      })
    expect(created.status).toBe(201)
    const id = created.body.id
    const heldStore = await openPackageStore({ rootDir: storage.DATA_DIR })
    await heldStore.acquireWriter()
    let deleteRes
    try {
      deleteRes = await request(app).delete(`/api/templates/${id}`)
    } finally {
      await heldStore.releaseWriter()
    }

    expect(deleteRes.status).toBe(503)
    expect(deleteRes.body).toEqual({
      error: 'Package lifecycle is temporarily unavailable; retry deletion',
      code: 'PACKAGE_LIFECYCLE_UNAVAILABLE',
      retryable: true,
    })
    expect((await storage.readTemplates()).find((template) => template.id === id)).toMatchObject({
      id,
      title: created.body.title,
    })

    await request(app).delete(`/api/templates/${id}`)
  })

  it('keeps template JSON when deletion persistence fails', async () => {
    const created = await request(app)
      .post('/api/templates')
      .send({
        title: `Persistence failure ${Date.now()}`,
        slides: [{ id: 'persistence-failure-slide', elements: [] }],
      })
    expect(created.status).toBe(201)
    const id = created.body.id
    try {
      const writeJson = fs.writeJson.bind(fs)
      vi.spyOn(fs, 'writeJson').mockImplementation(async (file, ...args) => {
        if (String(file).includes('templates.json')) {
          throw new Error('injected template persistence failure')
        }
        return writeJson(file, ...args)
      })
      const deleted = await request(app).delete(`/api/templates/${id}`)
      expect(deleted).toMatchObject({
        status: 500,
        body: { error: 'injected template persistence failure' },
      })
      expect((await storage.readTemplates()).some((template) => template.id === id)).toBe(true)
    } finally {
      vi.restoreAllMocks()
      await request(app).delete(`/api/templates/${id}`)
    }
  })

  it('rejects invalid custom template payloads', async () => {
    const missingSlides = await request(app).post('/api/templates').send({ title: 'No Slides' })
    expect(missingSlides.status).toBe(400)

    const missingTitle = await request(app).post('/api/templates').send({
      slides: [{ id: 's1', elements: [] }],
    })
    expect(missingTitle.status).toBe(400)
  })

  it('serializes concurrent template mutations through one transaction lock', async () => {
    const ids = await Promise.all(
      ['Concurrent A', 'Concurrent B'].map(async (title) => {
        const res = await request(app)
          .post('/api/templates')
          .send({
            title,
            theme: 'black',
            transition: 'slide',
            slides: [{ id: title, elements: [] }],
          })
        expect(res.status).toBe(201)
        return res.body.id
      })
    )

    const listRes = await request(app).get('/api/templates')
    expect(listRes.status).toBe(200)
    for (const id of ids) {
      expect(listRes.body.some((item) => item.id === id)).toBe(true)
      await request(app).delete(`/api/templates/${id}`)
    }
  })
})
