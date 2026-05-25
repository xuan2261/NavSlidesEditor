import fs from 'node:fs/promises'
import path from 'node:path'
import {
  apiGetPresentation,
  apiUpdatePresentation,
  expect,
  test,
} from '../fixtures/test-fixtures.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const PPTX_FIXTURES = ['Bai_2_1.pptx', 'Bai_2_2.pptx', 'Bai_2_5.pptx']

async function waitForPptxImport(request, jobId) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const poll = await request.get(`/api/pptx/jobs/${jobId}`)
    expect(poll.ok()).toBeTruthy()
    const job = await poll.json()
    if (job.status === 'done') return job.result
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.error || `PPTX import ${job.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Timed out waiting for PPTX import job')
}

async function importAndUpdate(request, fixturePath, testPresentation) {
  const buffer = await fs.readFile(fixturePath)
  const importRes = await request.post('/api/pptx/import', {
    multipart: {
      file: { name: path.basename(fixturePath), mimeType: PPTX_MIME, buffer },
    },
  })
  expect(importRes.status()).toBe(202)
  const { jobId } = await importRes.json()
  const imported = await waitForPptxImport(request, jobId)
  expect(imported.presentation?.slides?.length).toBeGreaterThan(0)
  const presentation = await apiUpdatePresentation(request, testPresentation.id, imported.presentation)
  return { imported, presentation }
}

test.describe('PPTX import endpoint and presentation creation roundtrip across multiple fixtures', () => {
  for (const fixture of PPTX_FIXTURES) {
    test(`imports ${fixture}, updates presentation, and round-trips slides via API`, async ({
      request,
      testPresentation,
    }) => {
      test.setTimeout(150000)
      const fixturePath = path.resolve(process.cwd(), 'PPTX', fixture)
      const { imported, presentation } = await importAndUpdate(request, fixturePath, testPresentation)

      expect(presentation.id).toBeTruthy()
      expect(Array.isArray(presentation.slides)).toBe(true)
      expect(presentation.slides.length).toBe(imported.presentation.slides.length)

      const fetched = await apiGetPresentation(request, presentation.id)
      expect(fetched.slides.length).toBe(presentation.slides.length)
      expect(fetched.slides[0].elements?.length || 0).toBeGreaterThanOrEqual(0)
    })
  }

  test('rejects non-pptx file with 400', async ({ request }) => {
    const res = await request.post('/api/pptx/import', {
      multipart: {
        file: { name: 'fake.txt', mimeType: 'text/plain', buffer: Buffer.from('not a pptx') },
      },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects request without file with 400', async ({ request }) => {
    const res = await request.post('/api/pptx/import', { multipart: {} })
    expect(res.status()).toBe(400)
  })

  test('imported presentation persists element bounds and types', async ({
    request,
    testPresentation,
  }) => {
    test.setTimeout(150000)
    const fixturePath = path.resolve(process.cwd(), 'PPTX', 'Bai_2_2.pptx')
    const { presentation } = await importAndUpdate(request, fixturePath, testPresentation)

    const fetched = await apiGetPresentation(request, presentation.id)
    const allElements = fetched.slides.flatMap((s) => s.elements || [])
    expect(allElements.length).toBeGreaterThan(0)
    for (const el of allElements) {
      expect(typeof el.id).toBe('string')
      expect(typeof el.type).toBe('string')
      expect(typeof el.x).toBe('number')
      expect(typeof el.y).toBe('number')
      expect(el.width).toBeGreaterThan(0)
      expect(el.height).toBeGreaterThan(0)
    }
  })
})
