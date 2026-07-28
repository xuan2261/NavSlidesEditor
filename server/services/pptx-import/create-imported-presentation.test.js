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

  // The title comes from the uploaded filename or the deck's own OOXML, and is
  // read back by operators — the GitHub push builds its commit message from it.
  // Written as textual escapes so the source stays readable and non-binary.
  describe('title sanitization', () => {
    // eslint-disable-next-line no-control-regex -- asserting these never survive
    const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f]')
    const C = String.fromCharCode
    const stamp = (mapped, options) =>
      stampImportedPresentationFields(mapped, { id: 'pres-x', ...options })

    it('strips control bytes from a mapped title but keeps the readable text', () => {
      const title = stamp({ title: `Q4${C(27)}[31m Review${C(7)}${C(0)}` }).title
      expect(CONTROL_CHARS.test(title)).toBe(false)
      expect(title).toBe('Q4 [31m Review')
    })

    it('strips control bytes from the originalName fallback', () => {
      const title = stamp({}, { originalName: `deck${C(27)}]0;pwned${C(7)}` }).title
      expect(CONTROL_CHARS.test(title)).toBe(false)
      expect(title).toBe('deck ]0;pwned')
    })

    it('falls through when sanitizing leaves nothing behind', () => {
      expect(stamp({ title: C(27) + C(7) }, { originalName: 'deck.pptx' }).title).toBe('deck.pptx')
      expect(stamp({ title: C(0) }, { originalName: C(27) }).title).toBe('Imported Presentation')
    })
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
