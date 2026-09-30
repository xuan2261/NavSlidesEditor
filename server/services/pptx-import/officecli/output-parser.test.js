import { describe, expect, it } from 'vitest'
import outputParser from './output-parser.js'

const { parseValidationResult } = outputParser
const validationData = { count: 0, errors: [] }

function officeCliSuccess(overrides = {}) {
  return JSON.stringify({ success: true, data: validationData, ...overrides })
}

describe('OfficeCLI v1.0.135 validation output', () => {
  it('normalizes the observed successful validation object without exposing CLI data', () => {
    const result = parseValidationResult(officeCliSuccess())

    expect(result).toEqual({ valid: true })
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('does not accept the legacy valid-only mock envelope', () => {
    expect(() => parseValidationResult('{"valid":true}')).toThrow(/success/)
  })

  it.each([
    ['missing success', JSON.stringify({ data: validationData })],
    ['false success', officeCliSuccess({ success: false })],
    ['string success', officeCliSuccess({ success: 'true' })],
    ['numeric success', officeCliSuccess({ success: 1 })],
    ['missing data', JSON.stringify({ success: true })],
    [
      'old string data envelope',
      officeCliSuccess({
        data: 'Validation passed: no errors found.',
        message: 'Validation passed: no errors found.',
      }),
    ],
    ['missing count', officeCliSuccess({ data: { errors: [] } })],
    ['nonzero count', officeCliSuccess({ data: { count: 1, errors: [] } })],
    [
      'nonempty errors with zero count',
      officeCliSuccess({ data: { count: 0, errors: [{ code: 'OPC_INVALID' }] } }),
    ],
    ['nonarray errors', officeCliSuccess({ data: { count: 0, errors: false } })],
    ['non-string message', officeCliSuccess({ message: false })],
    ['conflicting legacy status', officeCliSuccess({ valid: false })],
    ['duplicate legacy status', officeCliSuccess({ valid: true })],
    ['malformed JSON', '{"success":true'],
    ['array root', '[]'],
  ])('rejects %s', (_case, stdout) => {
    expect(() => parseValidationResult(stdout)).toThrow(/OfficeCLI (?:validation|JSON)/)
  })
})
