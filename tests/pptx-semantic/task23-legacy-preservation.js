// Task23 legacy deck preservation: editing, saving, duplicating, and templating legacy decks
// without unintended semantic migration, package attachment, or fabricated Original authority.
import request from 'supertest'
import { expect } from 'vitest'
import { editor } from '../../server/routes/portable-package-project-fixture.js'

export async function assertLegacyUnchangedPreservation({ current, initialId, read, save, originalFor }) {
  const created = await editor(request(current.app).post('/api/presentations')).send({
    title: 'Legacy unchanged lane',
    slides: [{
      id: 'legacy-slide',
      elements: [{
        id: 'legacy-text',
        type: 'text',
        x: 12,
        y: 18,
        width: 320,
        height: 80,
        content: '<p>Legacy before</p>',
      }],
    }],
  })
  expect(created.status, JSON.stringify(created.body)).toBe(201)

  const legacy = await read(created.body.id)
  expect(legacy.pptxSemantic).toBeUndefined()
  expect(legacy.pptxSourceAvailable).toBeUndefined()

  // Standard legacy edit and save
  legacy.slides[0].elements[0].content = '<p>Legacy after</p>'
  expect((await save(legacy, 'legacy-save')).status).toBe(200)

  // Injected forged package authority into legacy deck is stripped without corrupting storage
  const forged = {
    ...legacy,
    aggregateGeneration: 99,
    pptxAggregateHead: { packageRevisionId: 'forged-rev' },
    packageRevisionId: 'forged-rev',
    fencingEpoch: 12,
  }
  const forgedSave = await save(forged, 'legacy-forged-authority')
  expect(forgedSave.status).toBe(200)
  expect(forgedSave.body.pptxSemantic).toBeUndefined()
  expect(forgedSave.body.pptxAggregateHead).toBeUndefined()
  expect(forgedSave.body.packageRevisionId).toBeUndefined()

  await current.runtime.shutdownPackageStore()
  current.store = await current.runtime.initializePackageStore({ rootDir: current.storage.DATA_DIR })

  const reopened = await read(legacy.id)
  expect(reopened.slides[0].elements[0].content).toBe('<p>Legacy after</p>')
  expect(reopened.pptxSemantic).toBeUndefined()
  expect(reopened.pptxSourceAvailable).toBeUndefined()
  expect(reopened.pptxAggregateHead).toBeUndefined()

  // Legacy present serves standard HTML without semantic picture mounts
  const present = await request(current.app).get(`/api/presentations/${legacy.id}/present`)
  expect(present.status).toBe(200)
  expect(present.text).toContain('Legacy after')
  expect(present.text).not.toContain('data-pptx-picture=')

  // Original PPTX is absent for legacy decks
  const origRes = await request(current.app).get(`/api/presentations/${legacy.id}/pptx-original`)
  expect(origRes.status).not.toBe(200)

  // Duplicate of a legacy deck remains legacy
  const duplicate = await editor(request(current.app).post(`/api/presentations/${legacy.id}/duplicate`)).send({})
  expect(duplicate.status).toBe(201)
  expect(duplicate.body.pptxSemantic).toBeUndefined()
  expect(duplicate.body.pptxSourceAvailable).toBeUndefined()
  expect(duplicate.body.pptxAggregateHead).toBeUndefined()

  // Template from a legacy deck remains legacy
  const template = await editor(request(current.app).post(`/api/presentations/${legacy.id}/save-as-template`))
    .send({ title: 'Legacy template' })
  expect(template.status).toBe(201)
  expect(template.body.pptxSemantic).toBeUndefined()
  expect(template.body.pptxSourceAvailable).toBeUndefined()
  expect(template.body.pptxAggregateHead).toBeUndefined()

  // Ensure semantic deck was untouched throughout
  await originalFor(initialId)
}
