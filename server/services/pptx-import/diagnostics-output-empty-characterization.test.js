// @vitest-environment node
/**
 * Worker wire path must preserve output-empty through classifyError.
 */
import { describe, expect, it } from 'vitest'
import { assertUsableParserOutput } from './output-usability.js'
import { classifyError } from './diagnostics.js'
import { FAILURE_TYPES } from './constants.js'

describe('output-empty type preservation', () => {
  it('classifyError preserves assertUsableParserOutput type output-empty', () => {
    try {
      assertUsableParserOutput({ slides: [{ elements: [] }] })
      expect.unreachable('expected throw')
    } catch (err) {
      expect(err.type).toBe(FAILURE_TYPES.outputEmpty)
      expect(classifyError(err)).toBe(FAILURE_TYPES.outputEmpty)
    }
  })
})
