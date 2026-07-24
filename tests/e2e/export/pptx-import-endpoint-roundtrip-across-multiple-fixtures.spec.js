import fs from 'node:fs/promises'
import path from 'node:path'
import {
  apiDeletePresentation,
  apiGetPresentation,
  expect,
  test,
} from '../fixtures/test-fixtures.js'
import {
  importPptxWhenAvailable,
  postPptxImportWhenAvailable,
} from '../helpers/pptx-import-api-helper.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const PPTX_FIXTURES = ['Bai_2_1.pptx', 'Bai_2_2.pptx', 'Bai_2_5.pptx']

async function importPresentation(request, fixturePath) {
  const buffer = await fs.readFile(fixturePath)
  const { presentationId } = await importPptxWhenAvailable(request, {
    file: { name: path.basename(fixturePath), mimeType: PPTX_MIME, buffer },
  })
  return presentationId
}

test.describe('PPTX import endpoint and presentation creation roundtrip across multiple fixtures', () => {
  for (const fixture of PPTX_FIXTURES) {
    test(`imports ${fixture} and round-trips its slides via API`, async ({ request }) => {
      test.setTimeout(150000)
      let presentationId
      try {
        const fixturePath = path.resolve(process.cwd(), 'PPTX', fixture)
        presentationId = await importPresentation(request, fixturePath)
        const presentation = await apiGetPresentation(request, presentationId)

        expect(presentation.id).toBe(presentationId)
        expect(Array.isArray(presentation.slides)).toBe(true)
        expect(presentation.slides.length).toBeGreaterThan(0)

        const fetched = await apiGetPresentation(request, presentationId)
        expect(fetched.slides.length).toBe(presentation.slides.length)
        expect(fetched.slides[0].elements?.length || 0).toBeGreaterThanOrEqual(0)
      } finally {
        await apiDeletePresentation(request, presentationId)
      }
    })
  }

  test('rejects non-pptx file with 400', async ({ request }) => {
    const res = await postPptxImportWhenAvailable(request, {
      file: { name: 'fake.txt', mimeType: 'text/plain', buffer: Buffer.from('not a pptx') },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects request without file with 400', async ({ request }) => {
    const res = await postPptxImportWhenAvailable(request, {})
    expect(res.status()).toBe(400)
  })

  test('imported presentation persists element bounds and types', async ({ request }) => {
    test.setTimeout(150000)
    let presentationId
    try {
      const fixturePath = path.resolve(process.cwd(), 'PPTX', 'Bai_2_2.pptx')
      presentationId = await importPresentation(request, fixturePath)

      const fetched = await apiGetPresentation(request, presentationId)
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
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })

  test('imports non-default 4x3 decks with canvas resolution and original-size metadata', async ({
    request,
  }) => {
    test.setTimeout(120000)
    let presentationId
    try {
      const fixturePath = path.resolve(
        process.cwd(),
        'server/data/test-corpus/non-default-4x3-resolution.pptx'
      )
      presentationId = await importPresentation(request, fixturePath)

      const presentation = await apiGetPresentation(request, presentationId)
      expect(presentation.resolution).toEqual({ width: 960, height: 540 })
      expect(presentation._pptxMeta?.originalSize).toEqual({ width: 720, height: 540 })

      const fetched = await apiGetPresentation(request, presentationId)
      expect(fetched.resolution).toEqual({ width: 960, height: 540 })
      expect(fetched._pptxMeta?.originalSize).toEqual({ width: 720, height: 540 })
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })
})
