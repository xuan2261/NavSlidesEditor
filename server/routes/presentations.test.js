import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
import * as storage from '../services/storage.js'
import presentationsRouter from './presentations.js'
import templatesRouter from './templates.js'

function createApp() {
  const app = express()
  app.use(express.json({ limit: '5mb' }))
  app.use('/api/presentations', presentationsRouter)
  app.use('/api/templates', templatesRouter)
  return app
}

describe('Presentations API', () => {
  const app = createApp()

  beforeAll(() => {
    storage.initDataFiles()
  })

  it('covers CRUD, trash/restore, duplicate, export, present, and save-as-template', async () => {
    const title = `Route Test ${Date.now()}`
    const createRes = await request(app)
      .post('/api/presentations')
      .send({
        title,
        theme: 'dracula',
        transition: 'fade',
        slides: [
          {
            id: 'slide-a',
            notes: 'Legacy note',
            elements: [
              {
                id: 'el-a',
                type: 'text',
                x: 80,
                y: 80,
                width: 300,
                height: 120,
                content: '<p>Hello</p>',
              },
            ],
          },
        ],
      })

    expect(createRes.status).toBe(201)
    expect(createRes.body.title).toBe(title)
    expect(createRes.body.slides[0].notes).toBe('Legacy note')
    expect(createRes.body.slides[0].speakerNotes).toBeUndefined()
    const id = createRes.body.id

    const listRes = await request(app).get('/api/presentations')
    expect(listRes.status).toBe(200)
    expect(listRes.body.some((item) => item.id === id && item.slideCount === 1)).toBe(true)

    const getRes = await request(app).get(`/api/presentations/${id}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.title).toBe(title)

    const updateRes = await request(app)
      .put(`/api/presentations/${id}`)
      .send({ title: `${title} Updated`, slides: getRes.body.slides })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.title).toBe(`${title} Updated`)

    const duplicateRes = await request(app).post(`/api/presentations/${id}/duplicate`)
    expect(duplicateRes.status).toBe(201)
    expect(duplicateRes.body.id).not.toBe(id)
    expect(duplicateRes.body.title).toContain('(copy)')

    const exportRes = await request(app).get(`/api/presentations/${id}/export`)
    expect(exportRes.status).toBe(200)
    expect(exportRes.headers['content-type']).toContain('text/html')
    expect(exportRes.text).toContain('Hello')

    const presentRes = await request(app).get(`/api/presentations/${id}/present?preview=true`)
    expect(presentRes.status).toBe(200)
    expect(presentRes.text).toContain('controls: false')

    const templateRes = await request(app)
      .post(`/api/presentations/${id}/save-as-template`)
      .send({ title: 'Reusable' })
    expect(templateRes.status).toBe(201)
    expect(templateRes.body.isTemplate).toBe(true)

    const deleteRes = await request(app).delete(`/api/presentations/${id}`)
    expect(deleteRes.status).toBe(200)

    const trashRes = await request(app).get('/api/presentations/trash/list')
    expect(trashRes.status).toBe(200)
    expect(trashRes.body.some((item) => item.id === id)).toBe(true)

    const restoreRes = await request(app).post(`/api/presentations/${id}/restore`)
    expect(restoreRes.status).toBe(200)

    const permanentDelete = await request(app).delete(`/api/presentations/${id}/permanent`)
    expect(permanentDelete.status).toBe(200)

    await request(app).delete(`/api/presentations/${duplicateRes.body.id}/permanent`)
    await request(app).delete(`/api/templates/${templateRes.body.id}`)
  })

  it('returns 404 for missing presentation mutations and lookup', async () => {
    expect((await request(app).get('/api/presentations/missing')).status).toBe(404)
    expect((await request(app).put('/api/presentations/missing').send({ title: 'Nope' })).status).toBe(404)
    expect((await request(app).delete('/api/presentations/missing')).status).toBe(404)
    expect((await request(app).post('/api/presentations/missing/duplicate')).status).toBe(404)
    expect((await request(app).get('/api/presentations/missing/export')).status).toBe(404)
  })

  it('removes both legacy and object-format share tokens on permanent delete', async () => {
    const created = await request(app).post('/api/presentations').send({ title: 'Cascade test' })
    expect(created.status).toBe(201)
    const id = created.body.id

    await storage.writeShareTokens({
      legacyToken: id,
      objectToken: { presentationId: id, views: 2 },
      otherToken: { presentationId: 'different-id' },
    })

    const deleteRes = await request(app).delete(`/api/presentations/${id}/permanent`)
    expect(deleteRes.status).toBe(200)

    const tokens = await storage.readShareTokens()
    expect(tokens.legacyToken).toBeUndefined()
    expect(tokens.objectToken).toBeUndefined()
    expect(tokens.otherToken).toBeDefined()
  })
})
