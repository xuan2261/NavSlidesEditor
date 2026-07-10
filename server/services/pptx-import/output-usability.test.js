import { describe, expect, it } from 'vitest'
import {
  assertUsableParserOutput,
  inspectParserOutputUsability,
} from './output-usability.js'

describe('parser output usability', () => {
  it('rejects a deck whose slides are all empty', () => {
    const output = { slides: [{ elements: [] }, { elements: [] }] }
    expect(inspectParserOutputUsability(output)).toMatchObject({
      usable: false,
      reason: 'all-slides-empty',
      slideCount: 2,
      meaningfulElementCount: 0,
    })
    expect(() => assertUsableParserOutput(output)).toThrow(
      expect.objectContaining({
        type: 'output-empty',
        code: 'all-slides-empty',
      })
    )
  })

  it('accepts output containing a meaningful element', () => {
    expect(
      inspectParserOutputUsability({
        slides: [{ elements: [] }, { elements: [{ type: 'text', content: '<p>Hello</p>' }] }],
      }).usable
    ).toBe(true)
  })
})
