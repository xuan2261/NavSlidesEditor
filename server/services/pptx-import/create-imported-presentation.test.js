import { describe, expect, it } from 'vitest'
import {
  stampImportedPresentationFields,
} from './create-imported-presentation.js'

describe('stampImportedPresentationFields', () => {
  it('assigns ids, title fallback, and strips template fields without requiring storage', () => {
    const stamped = stampImportedPresentationFields(
      {
        theme: 'white',
        isTemplate: true,
        description: 'x',
        thumbnail: 't',
        slides: [{ elements: [{ type: 'text', content: 'hi' }] }],
      },
      {
        id: 'pres-1',
        originalName: 'deck.pptx',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        packageHead: { generation: 1, packageRevisionId: 'r0' },
      }
    )

    expect(stamped).toMatchObject({
      id: 'pres-1',
      title: 'deck.pptx',
      theme: 'white',
      transition: 'slide',
      pptxAggregateHead: { generation: 1, packageRevisionId: 'r0' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(stamped.designTokens).toEqual(expect.any(Object))
    expect(stamped.slides[0].id).toEqual(expect.any(String))
    expect(stamped.slides[0].elements[0].id).toEqual(expect.any(String))
    expect(stamped.isTemplate).toBeUndefined()
    expect(stamped.description).toBeUndefined()
    expect(stamped.thumbnail).toBeUndefined()
  })

  it('is pure and returns a new object identity for the same logical input', () => {
    const mapped = {
      title: 'Shared',
      theme: 'black',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text' }] }],
    }
    const options = {
      id: 'pres-shared',
      originalName: 'a.pptx',
      createdAt: '2026-02-02T00:00:00.000Z',
      updatedAt: '2026-02-02T00:00:00.000Z',
    }
    const a = stampImportedPresentationFields(mapped, options)
    const b = stampImportedPresentationFields(mapped, options)
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
})
