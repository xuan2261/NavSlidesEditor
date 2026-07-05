import { beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
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

    const updateRes = await request(app).put(`/api/templates/${id}`).send({ title: 'Updated Template' })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.title).toBe('Updated Template')

    const deleteRes = await request(app).delete(`/api/templates/${id}`)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.success).toBe(true)

    expect((await request(app).get(`/api/templates/${id}`)).status).toBe(404)
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
