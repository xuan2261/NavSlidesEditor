import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pictureFixture } from './semantic-picture-fixture'
const require = createRequire(import.meta.url)
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { semanticInstance, replaceSemanticRecords } = require('../../shared/src/pptx-semantic-records')
const { canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { collectMediaUrls, rewritePresentationMedia, buildImportedPresentation } = require('../../server/services/project-import-presentation')
const { rebindAuthorityResult, validateAuthorityResult } = require('../../server/services/pptx-import/package-store/portable-authority')
const { deriveMutationJournal, replayJournal } = require('../../server/services/pptx-import/mutation-journal')
const { buildImportSourceMap } = require('../../server/services/pptx-import/source-map')
let uploadsDir
beforeEach(async () => { uploadsDir = await mkdtemp(join(tmpdir(), 'picture-portable-')) })
afterEach(async () => { await rm(uploadsDir, { recursive: true, force: true }) })
const receipt = { kind: 'uploaded-picture', presentationId: 'pictures', filename: 'replacement.png',
  sha256: 'b'.repeat(64), width: 8, height: 4 }
const map = { '/uploads/replacement.png': '/uploads/imported.png', '/uploads/second.png': '/uploads/imported-second.png' }
function replacement(deck) {
  const element = deck.slides[0].elements[0]
  return semanticInstance(deck.pptxSemantic, element.pptxInstanceId)
    .overrides.components[element.pptxPicture.componentId].picture.replacement
}
async function fixture(schema) {
  const { presentation } = await pictureFixture({ uploadsDir })
  const element = presentation.slides[0].elements[0]
  const before = applyPresentationProjectionOperation(presentation, { type: 'picture.edit',
    instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
    command: { type: 'replace', replacement: receipt, expectedReplacement: null } })
  if (schema === 3) before.pptxSemantic = compactSemanticGraph(before.pptxSemantic)
  return canonicalEditableSnapshot(before)
}
describe.each([2, 3])('portable uploaded pictures schema %i', schema => {
  it('inventories media without changing even a foreign owner receipt', async () => {
    const input = { ...await fixture(schema), id: 'another-presentation' }
    const frozen = structuredClone(input)
    expect(collectMediaUrls(input)).toContain('/uploads/replacement.png')
    expect(input).toEqual(frozen)
    expect(() => normalizeSemanticPresentation(input)).toThrow('Picture replacement belongs to another presentation')
  })
  it('rebinds owner and uploaded filename before publication without altering source or sibling', async () => {
    const input = await fixture(schema), frozen = structuredClone(input)
    const result = rewritePresentationMedia(input, map, 'destination')
    expect(result.id).toBe('destination')
    expect(replacement(result)).toEqual({ ...receipt, presentationId: 'destination', filename: 'imported.png' })
    expect(normalizeSemanticPresentation(result).slides[0].elements[0].src).toBe('/uploads/imported.png')
    expect(result.slides[0].elements[1]).toEqual(input.slides[0].elements[1])
    expect(result.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(input).toEqual(frozen)
    const imported = buildImportedPresentation({ presentation: input, intendedPresentationId: 'destination',
      commitStartedAt: '2026-10-27T00:00:00.000Z', sessionId: 'session', payloadDigest: 'a'.repeat(64),
      placements: [{ originalUrl: '/uploads/replacement.png', filename: 'imported.png' }] })
    expect(replacement(normalizeSemanticPresentation(imported))).toEqual(replacement(result))
  })
  it('rejects a replacement override outside the declared source components', async () => {
    const input = await fixture(schema), element = input.slides[0].elements[0]
    const instance = semanticInstance(input.pptxSemantic, element.pptxInstanceId)
    const overrides = { ...instance.overrides, components: { ...instance.overrides.components,
      unknown: { picture: { replacement: receipt } } } }
    const invalid = { ...input, pptxSemantic: replaceSemanticRecords(input.pptxSemantic,
      { instances: { [instance.id]: { ...instance, overrides } } }) }
    expect(() => normalizeSemanticPresentation(invalid)).toThrow('Override targets an unknown component')
    expect(() => rewritePresentationMedia(input, { '/uploads/replacement.png': '/uploads/../escape.png' }, 'destination'))
      .toThrow('Invalid uploaded picture replacement')
    expect(replacement(input)).toEqual(receipt)
  })
  it('rebinds journal preconditions and inverse values so replacement history still replays', async () => {
    const before = await fixture(schema)
    const element = before.slides[0].elements[0]
    const after = canonicalEditableSnapshot(applyPresentationProjectionOperation(before, {
      type: 'picture.edit', instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
      command: { type: 'replace', replacement: { ...receipt, filename: 'second.png', sha256: 'c'.repeat(64) },
        expectedReplacement: receipt } }))
    const sourceMap = await buildImportSourceMap(before, null, null, { revisionId: 'original', packageGeneration: 1 })
    const result = { schemaVersion: 1, operation: 'projection-save', presentationId: 'pictures',
      generation: 2, packageRevisionId: 'original', idempotencyKey: 'save', state: 'pending-edited-export',
      projection: after, sourceMap: { ...sourceMap, packageGeneration: 2 },
      journal: deriveMutationJournal(before, after, { sourceMap, baseRevisionId: 'original', matrixAuthorityEpoch: 1 }) }
    const frozen = structuredClone(result)
    const rebound = rebindAuthorityResult(result, { presentationId: 'destination', matrixAuthorityEpoch: 1 }, n => n, map)
    validateAuthorityResult(rebound, { presentationId: 'destination', packageRevisionId: 'original', generation: 2 })
    const base = canonicalEditableSnapshot(rewritePresentationMedia(before, map, 'destination'))
    const replayed = canonicalEditableSnapshot(replayJournal(base, rebound.journal))
    expect(replayed).toEqual(rebound.projection)
    const inverse = { operations: [...rebound.journal.operations].reverse().map(op => ({ ...op,
      before: op.after, after: op.inverse.value })) }
    expect(canonicalEditableSnapshot(replayJournal(replayed, inverse))).toEqual(base)
    expect(replacement(replayed)).toEqual({ ...receipt, filename: 'imported-second.png',
      sha256: 'c'.repeat(64), presentationId: 'destination' })
    expect(result).toEqual(frozen)
  })
})
