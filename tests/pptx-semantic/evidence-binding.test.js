import { describe, expect, it } from 'vitest'
import { verifySemanticBinding } from '../../scripts/ci/pptx-semantic-runner-results.mjs'

const current = {
  manifestDigest: 'a'.repeat(64),
  implementationDigest: 'b'.repeat(64),
  runnerDigest: 'c'.repeat(64),
}

describe('machine result source binding', () => {
  it('accepts only a report bound to the exact manifest, implementation and runner bytes', () => {
    expect(verifySemanticBinding({ schemaVersion: 1, ...current }, current)).toEqual({
      ok: true,
      errors: [],
    })
  })

  it.each(Object.keys(current))('rejects stale %s even when tests say passed', (field) => {
    const binding = { schemaVersion: 1, ...current, [field]: '0'.repeat(64) }
    expect(verifySemanticBinding(binding, current)).toEqual({
      ok: false,
      errors: [`semantic-binding-mismatch:${field}`],
    })
  })

  it('does not accept an unversioned success declaration as binding', () => {
    expect(verifySemanticBinding({ success: true }, current).ok).toBe(false)
  })
})
