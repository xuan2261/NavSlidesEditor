import { describe, expect, it } from 'vitest'
import schemas from '../../server/middleware/schemas.js'
import { familyDocumentsFixture } from './family-documents-fixture'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations.js'

async function presentation() {
  const document = (await familyDocumentsFixture()).diagram
  return {
    title: 'Source diagram',
    pptxSemantic: document,
    slides: [
      {
        id: 's1',
        elements: [
          familyCompatibilityElement(document, {
            id: 'diagram',
            type: 'diagram',
            pptxInstanceId: 'occurrence',
            x: 0,
            y: 0,
            width: 50,
            height: 50,
          }),
        ],
      },
    ],
  }
}

describe('source diagram persistence admission', () => {
  it.each([
    schemas.createPresentationSchema,
    schemas.updatePresentationSchema,
    schemas.createTemplateSchema,
    schemas.updateTemplateSchema,
  ])(
    'retains the canonical document and diagram through its existing sink schema',
    async (schema) => {
      const candidate = await presentation()
      const result = schema.safeParse(candidate)
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
      const reopened = schema.parse(JSON.parse(JSON.stringify(result.data)))
      expect(reopened.pptxSemantic).toEqual(candidate.pptxSemantic)
      expect(reopened.slides[0].elements[0]).toMatchObject({
        type: 'diagram',
        pptxInstanceId: 'occurrence',
        smartArtDocument: candidate.slides[0].elements[0].smartArtDocument,
      })
    }
  )

  it.each([schemas.createPresentationSchema, schemas.updatePresentationSchema])(
    'still rejects a dangling canonical instance instead of accepting a flattened diagram',
    async (schema) => {
      const candidate = await presentation()
      candidate.pptxSemantic.instances.occurrence.definitionId = 'missing'
      expect(schema.safeParse(candidate).success).toBe(false)
    }
  )
})
