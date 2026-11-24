import { describe, it, expect } from 'vitest'
const { resolveEditedExportContext } = require('./validated-edited-export-context')
const { hashRecord } = require('./package-store/schemas')

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function fixture() {
  const before = { id: 'deck', slides: [{ id: 's', elements: [{ id: 't', type: 'text', content: { type: 'doc', content: [] }, x: 1 }] }] }
  const after = structuredClone(before)
  after.slides[0].elements[0].content.content = [{ type: 'paragraph', content: [{ type: 'text', text: 'edited' }] }]
  const sourceMap = { presentationId: 'deck', revisionId: 'r', packageGeneration: 2 }
  return {
    heads: [{ presentationId: 'deck', packageRevisionId: 'r', generation: 2, pendingJournalHash: 'j', journalRevisionId: 'j' }],
    mutationResults: [
      { presentationId: 'deck', packageRevisionId: 'r', generation: 1, state: 'committed', projection: before, sourceMap: { ...sourceMap, packageGeneration: 1 } },
      { presentationId: 'deck', packageRevisionId: 'r', generation: 2, state: 'pending-edited-export', projection: after, sourceMap, journal: { journalHash: 'j' } },
    ],
  }
}
describe('edited export context immutable non-text comparison', () => {
  it('accepts text-only edits on owned immutable data and rejects changed non-text data', () => {
    expect(resolveEditedExportContext(freeze(fixture()), 'deck')).toMatchObject({ ok: true, textExportEligible: true })
    const changed = fixture()
    changed.mutationResults[1].projection.slides[0].elements[0].x = 2
    expect(resolveEditedExportContext(freeze(changed), 'deck')).toMatchObject({ ok: true, textExportEligible: false })
  })
  it('rechecks mutable data even at the same generation', () => {
    const state = fixture()
    expect(resolveEditedExportContext(state, 'deck').textExportEligible).toBe(true)
    state.mutationResults[1].projection.slides[0].elements[0].x = 3
    expect(resolveEditedExportContext(state, 'deck').textExportEligible).toBe(false)
  })
  it('rejects forged pending generations and source identity', () => {
    for (const mutate of [
      (state) => { state.heads[0].generation++ },
      (state) => { state.mutationResults[1].sourceMap.revisionId = 'forged' },
      (state) => { state.mutationResults[1].sourceMap.packageGeneration++ },
    ]) {
      const state = fixture()
      mutate(state)
      expect(resolveEditedExportContext(freeze(state), 'deck').ok).toBe(false)
    }
  })
  it('checks exact committed projection and source hashes', () => {
    const state = fixture()
    state.mutationResults.pop()
    const result = state.mutationResults[0]
    state.heads[0] = { presentationId: 'deck', packageRevisionId: 'r', generation: 1,
      projectionRevisionId: hashRecord(result.projection), sourceMapRevisionId: hashRecord(result.sourceMap) }
    expect(resolveEditedExportContext(state, 'deck').ok).toBe(true)
    result.sourceMap.revisionId = 'forged'
    expect(resolveEditedExportContext(state, 'deck').ok).toBe(false)
  })
})
