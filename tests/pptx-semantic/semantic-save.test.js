import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  toPresentationEditorDto,
  toExternalPresentationDto,
} = require('../../server/services/pptx-import/package-store/dto')
const {
  sanitizeClientEditableData,
} = require('../../server/services/pptx-import/authority-sanitizer')
const {
  canonicalEditableSnapshot,
} = require('../../server/services/pptx-import/canonical-snapshot')
const {
  createPresentationSchema,
  updatePresentationSchema,
} = require('../../server/middleware/schemas')

function presentation() {
  return {
    id: 'deck',
    slides: [
      {
        id: 's1',
        elements: [
          {
            id: 'leaf',
            type: 'shape',
            shapeType: 'rect',
            x: -1.25,
            y: 2.5,
            width: 96,
            height: 48,
            pptxInstanceId: 'i1',
          },
        ],
      },
    ],
    pptxSemantic: {
      schemaVersion: 1,
      styles: {},
      fonts: {},
      definitions: {
        d1: {
          id: 'd1',
          kind: 'shape',
          components: [],
          source: {
            partUri: 'ppt/slides/slide1.xml',
            nativeId: '2',
            preconditionHash: 'a'.repeat(64),
          },
          content: { extent: { cx: 914400, cy: 457200 } },
        },
      },
      instances: {
        i1: {
          id: 'i1',
          definitionId: 'd1',
          slideId: 's1',
          parentInstanceId: null,
          localTransform: [1, 0, 0, 1, -11906.25, 23812.5],
          paintIndex: 0,
          overrides: { hidden: false },
        },
      },
    },
  }
}

describe('semantic save admission at actual schema/sanitizer/snapshot boundaries', () => {
  it('rejects image links whose derived URL differs from their canonical source binding', () => {
    const input = presentation()
    input.slides[0].elements[0].type = 'image'
    input.slides[0].elements[0].src = '/uploads/other.png'
    input.pptxSemantic.definitions.d1.kind = 'image'
    input.pptxSemantic.definitions.d1.content.media = {
      partUri: 'ppt/media/image1.png',
      relationshipId: 'rId2',
      src: '/uploads/source.png',
    }
    expect(updatePresentationSchema.safeParse(input).success).toBe(false)
    input.slides[0].elements[0].src = '/uploads/source.png'
    expect(updatePresentationSchema.safeParse(input).success).toBe(true)
  })
  it.each(['future-text', 'negative-size', 'duplicate-run', 'wrong-body'])(
    'rejects invalid canonical text overrides at the save boundary: %s',
    (failure) => {
      const input = presentation()
      const text = {
        schemaVersion: 1,
        componentId: 'body',
        body: {},
        paragraphs: [
          {
            componentId: 'paragraph',
            runs: [
              { componentId: 'run', kind: 'text', text: ' A ', properties: { fontSizePt: 12 } },
            ],
          },
        ],
      }
      const definition = input.pptxSemantic.definitions.d1
      definition.content.textDocument = text
      definition.components.push({
        id: 'body',
        kind: 'property',
        locator: {
          path: [0, 1],
          preconditionHash: definition.source.preconditionHash,
        },
      })
      const edited = structuredClone(text)
      if (failure === 'future-text') edited.schemaVersion = 99
      if (failure === 'negative-size') edited.paragraphs[0].runs[0].properties.fontSizePt = -1
      if (failure === 'duplicate-run')
        edited.paragraphs[0].runs.push(structuredClone(edited.paragraphs[0].runs[0]))
      if (failure === 'wrong-body') edited.componentId = 'different-body'
      input.pptxSemantic.instances.i1.overrides.components = { body: { textDocument: edited } }
      expect(updatePresentationSchema.safeParse(input).success).toBe(false)
      expect(() => sanitizeClientEditableData(input)).toThrow()
    }
  )
  it.each([toPresentationEditorDto, toExternalPresentationDto])(
    'retains semantic state and links through actual read/export DTOs',
    (toDto) => {
      const input = presentation()
      input.pptxAggregateHead = { packageRevisionId: 'private' }
      const dto = toDto(input)
      expect(dto.pptxSemantic).toEqual(input.pptxSemantic)
      expect(dto.slides[0].elements[0].pptxInstanceId).toBe('i1')
      expect(dto).not.toHaveProperty('pptxAggregateHead')
    }
  )
  it('preserves the envelope and exact occurrence link while keeping package authority private', () => {
    const input = presentation()
    input.pptxAggregateHead = { generation: 123 }
    input.pptxOriginal = { packagePath: 'private' }
    const parsed = updatePresentationSchema.parse(input)
    const safe = sanitizeClientEditableData(parsed)
    const snapshot = canonicalEditableSnapshot(safe)
    expect(snapshot.pptxSemantic).toEqual(input.pptxSemantic)
    expect(snapshot.slides[0].elements[0].pptxInstanceId).toBe('i1')
    expect(snapshot).not.toHaveProperty('pptxAggregateHead')
    expect(snapshot).not.toHaveProperty('pptxOriginal')
    expect(input.pptxOriginal).toEqual({ packagePath: 'private' })
  })

  it.each([null, { schemaVersion: 99 }])(
    'rejects malformed/future envelope before sanitization: %j',
    (value) => {
      const input = presentation()
      input.pptxSemantic = value
      expect(() => sanitizeClientEditableData(input)).toThrow()
      expect(updatePresentationSchema.safeParse(input).success).toBe(false)
      expect(createPresentationSchema.safeParse(input).success).toBe(false)
    }
  )

  it('rejects nested authority rather than stripping it and pretending the envelope was valid', () => {
    const input = presentation()
    input.pptxSemantic.instances.i1.overrides.sourceAuthority = { transactionEligible: true }
    const original = JSON.stringify(input)
    expect(() => sanitizeClientEditableData(input)).toThrow()
    expect(JSON.stringify(input)).toBe(original)
    expect(updatePresentationSchema.safeParse(input).success).toBe(false)
  })

  it.each(['missing', 'wrong-slide', 'duplicate', 'unknown-slide'])(
    'rejects incoherent full presentation linkage: %s',
    (failure) => {
      const input = presentation()
      if (failure === 'missing') input.slides[0].elements = []
      if (failure === 'wrong-slide') input.pptxSemantic.instances.i1.slideId = 's2'
      if (failure === 'duplicate')
        input.slides[0].elements.push({ ...input.slides[0].elements[0], id: 'other' })
      if (failure === 'unknown-slide') input.pptxSemantic.instances.i1.slideId = 'absent'
      expect(updatePresentationSchema.safeParse(input).success).toBe(false)
    }
  )

  it('keeps legacy and partial title updates on their existing path', () => {
    const legacy = { title: 'Old', slides: [{ id: 's1', elements: [] }] }
    expect(sanitizeClientEditableData(updatePresentationSchema.parse(legacy))).toEqual(legacy)
    expect(updatePresentationSchema.parse({ title: 'Renamed' })).toEqual({ title: 'Renamed' })
  })
})
