import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createRequire } from 'node:module'
import * as storage from '../services/storage.js'

const require = createRequire(import.meta.url)
const app = express()
app.use(express.json())
app.use('/api/presentations', require('./presentations.js'))
const createdIds = []
const variable = (id = 'score') => ({ id, name: 'Score', min: -10, initialValue: 0, max: 10 })
const deck = () => ({
  title: 'Bounded interactions',
  interactionVariables: [variable()],
  slides: [
    {
      id: 'slide',
      elements: [
        {
          id: 'source',
          type: 'shape',
          action: { kind: 'score-add', variableId: 'score', amount: 1 },
        },
      ],
    },
  ],
})
beforeAll(() => storage.initDataFiles())
afterEach(async () => {
  for (const id of createdIds.splice(0))
    await request(app).delete(`/api/presentations/${id}/permanent`)
})
async function create(body) {
  const response = await request(app).post('/api/presentations').send(body)
  if (response.body.id) createdIds.push(response.body.id)
  return response
}

describe('complete presentation interaction admission', () => {
  it('persists 32 declarations and keeps a partial title update valid when declarations are omitted', async () => {
    const body = deck()
    body.interactionVariables = Array.from({ length: 32 }, (_, i) =>
      variable(i === 0 ? 'score' : `v${i}`)
    )
    const created = await create(body)
    expect(created.status).toBe(201)
    const updated = await request(app)
      .put(`/api/presentations/${created.body.id}`)
      .send({ title: 'New title' })
    expect(updated.status).toBe(200)
    const loaded = await request(app).get(`/api/presentations/${created.body.id}`)
    expect(loaded.body.interactionVariables).toEqual(body.interactionVariables)
    expect(loaded.body.slides[0].elements[0].action.variableId).toBe('score')
  })

  it.each([
    ['too many', Array.from({ length: 33 }, (_, i) => variable(`v${i}`))],
    ['duplicate', [variable(), variable()]],
    ['null nonfinite JSON representation', [{ ...variable(), initialValue: null }]],
    ['reversed', [{ ...variable(), min: 5 }]],
    ['out of bounds', [{ ...variable(), max: 1_000_000_001 }]],
  ])(
    'rejects %s declarations on create and update without replacing saved content',
    async (_label, interactionVariables) => {
      expect((await create({ ...deck(), interactionVariables })).status).toBe(400)
      const created = await create(deck())
      const rejected = await request(app)
        .put(`/api/presentations/${created.body.id}`)
        .send({ interactionVariables })
      expect(rejected.status).toBe(400)
      expect(
        (await request(app).get(`/api/presentations/${created.body.id}`)).body.interactionVariables
      ).toEqual([variable()])
    }
  )

  it('rejects removing declarations still referenced by saved actions, but permits atomic removal of both', async () => {
    const created = await create(deck())
    const rejected = await request(app)
      .put(`/api/presentations/${created.body.id}`)
      .send({ interactionVariables: [] })
    expect(rejected.status).toBe(400)
    expect(rejected.body.details).toContainEqual(
      expect.objectContaining({
        path: 'slides.0.elements.0.action.variableId',
        message: expect.stringMatching(/declared/i),
      })
    )
    const accepted = await request(app)
      .put(`/api/presentations/${created.body.id}`)
      .send({ interactionVariables: [], slides: [{ id: 'slide', elements: [] }] })
    expect(accepted.status).toBe(200)
    expect(accepted.body.interactionVariables).toEqual([])
  })

  it('admits legal new score actions on partial updates against existing declarations', async () => {
    const created = await create(deck())
    const updated = await request(app)
      .put(`/api/presentations/${created.body.id}`)
      .send({
        slides: [
          {
            id: 'slide',
            elements: [
              {
                id: 'subtract',
                type: 'shape',
                action: { kind: 'score-subtract', variableId: 'score', amount: 2 },
              },
            ],
          },
        ],
      })
    expect(updated.status).toBe(200)
    const rejected = await request(app)
      .put(`/api/presentations/${created.body.id}`)
      .send({
        slides: [
          {
            id: 'slide',
            elements: [
              {
                id: 'subtract',
                type: 'shape',
                action: { kind: 'score-subtract', variableId: 'missing', amount: 2 },
              },
            ],
          },
        ],
      })
    expect(rejected.status).toBe(400)
  })
})
