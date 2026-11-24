// Task23 sink serializers (present/share), remap fidelity, and sink generation fences.
import request from 'supertest'
import { expect } from 'vitest'
import { editor } from '../../server/routes/portable-package-project-fixture.js'

export async function assertPresentAndShareSerializers({ current, id, instanceId, isCropped = false }) {
  const share = await editor(request(current.app).post(`/api/presentations/${id}/share`)).send({ name: 'Compatibility share' })
  expect(share.status).toBe(200)
  expect(share.body).toHaveProperty('token')

  const urls = [
    `/api/presentations/${id}/present`,
    `/api/presentations/${id}/present?preview=true`,
    `/share/${share.body.token}`,
  ]

  const captured = []
  for (const url of urls) {
    const response = await request(current.app).get(url)
    expect(response.status, response.text).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.text).toContain('data-pptx-picture=')
    expect(response.text).toContain(instanceId)
    expect(response.headers['x-pptx-export-mode']).toBeUndefined()

    if (isCropped) {
      expect(response.text).toContain('data-pptx-picture=')
    }
    if (url.includes('preview=true')) {
      expect(response.text).toContain('controls: false')
    }
    captured.push(response.text)
  }
  return captured
}

export async function assertPendingProjectionFailsClosed({ current, id }) {
  const duplicate = await editor(request(current.app).post(`/api/presentations/${id}/duplicate`)).send({})
  expect(duplicate.status).toBe(409)
  expect(duplicate.body.code).toBe('PACKAGE_PENDING_PROJECTION')

  const template = await editor(request(current.app).post(`/api/presentations/${id}/save-as-template`))
    .send({ title: 'Pending template attempt' })
  expect(template.status).toBe(409)
  expect(template.body.code).toBe('PACKAGE_PENDING_PROJECTION')
}

export async function assertSinkGenerationFences({ current, id, generation }) {
  // project-archive export requires exact If-Pptx-Generation header
  const missingGen = await editor(request(current.app).get(`/api/presentations/${id}/project-archive`))
  expect(missingGen.status).toBe(428)
  expect(missingGen.body.code).toBe('EXPECTED_GENERATION_REQUIRED')

  const staleGen = await editor(request(current.app).get(`/api/presentations/${id}/project-archive`))
    .set('If-Pptx-Generation', String(generation + 99))
  expect(staleGen.status).toBe(409)
  expect(staleGen.body.code).toBe('SYNC_SOURCE_CHANGED')

  // pptx-original requires non-stale positive safe integer generation
  const invalidOrigGen = await request(current.app).get(`/api/presentations/${id}/pptx-original`)
    .set('If-Pptx-Generation', 'not-a-number')
  expect(invalidOrigGen.status).toBe(400)
  expect(invalidOrigGen.body.code).toBe('INVALID_EXPECTED_GENERATION')

  const staleOrigGen = await request(current.app).get(`/api/presentations/${id}/pptx-original`)
    .set('If-Pptx-Generation', String(generation + 99))
  expect(staleOrigGen.status).toBe(409)
  expect(staleOrigGen.body.code).toBe('STALE_GENERATION')
}
