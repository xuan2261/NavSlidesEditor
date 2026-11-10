// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { projectHyperlinks } from './hyperlink-source-fixture.js'
import { fieldPart } from './field-fixtures.js'
const require = createRequire(import.meta.url)
const { validateSourceSlides, resolveRunHyperlink } = require('../../shared/src/pptx-source-slide-references')
const { sourceNamespace } = require('../../server/services/pptx-import/semantic-source-slides')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
function sourceLink(presentation) {
  return Object.values(presentation.pptxSemantic.definitions).find((d) => d.source.partUri === fieldPart)
    .content.textDocument.paragraphs.flatMap((p) => p.runs).find((run) => run.hyperlinks).hyperlinks.hover
}
describe('immutable package-bound slide hyperlink references', () => {
  it('registers genuinely empty source targets and resolves stable IDs after JSON reopen, reorder and duplicate', async () => {
    const { presentation } = await projectHyperlinks(), link = sourceLink(presentation)
    const target = presentation.slides[1]
    expect(Object.values(presentation.pptxSemantic.definitions)
      .filter((definition) => definition.source.partUri === link.targetPartUri)).toHaveLength(0)
    expect(presentation.pptxSemantic.sourceSlides).toContainEqual(expect.objectContaining({
      sourceId: link.sourceId, partUri: link.targetPartUri, slideId: target.id,
    }))
    expect(link).not.toHaveProperty('action')
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
    expect(resolveRunHyperlink(reopened, link)).toEqual({ status: 'ready', action: { kind: 'slide', slideId: target.id } })
    const reordered = { ...reopened, slides: [...reopened.slides].reverse() }
    expect(resolveRunHyperlink(reordered, link)).toEqual(resolveRunHyperlink(reopened, link))
    const { cloneSlideWithNewIds } = await import('../../client/src/hooks/slide-operation-helpers.js')
    let nextId = 0
    const duplicate = cloneSlideWithNewIds(target, () => `copy-${++nextId}`)
    const duplicated = { ...reopened, slides: [...reopened.slides, duplicate] }
    expect(resolveRunHyperlink(duplicated, link).action.slideId).toBe(target.id)
    expect(duplicated.pptxSemantic.sourceSlides).toBe(reopened.pptxSemantic.sourceSlides)
    const copiedDeck = structuredClone(duplicated)
    copiedDeck.id = 'duplicate-presentation-owner'
    expect(resolveRunHyperlink(copiedDeck, link).action.slideId).toBe(target.id)
  })
  it('keeps deleted target provenance immutable while explicitly disabling the unresolved action', async () => {
    const { presentation } = await projectHyperlinks(), link = sourceLink(presentation)
    const deleted = structuredClone(presentation)
    deleted.slides.splice(1, 1)
    for (const instance of Object.values(deleted.pptxSemantic.instances)) {
      if (instance.slideId === presentation.slides[1].id)
        instance.lineage = { ...instance.lineage, tombstone: true, deleted: true }
    }
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(deleted)))
    expect(() => assertSemanticBaseline(presentation, reopened)).not.toThrow()
    expect(resolveRunHyperlink(reopened, link)).toEqual({ status: 'unresolved', reason: 'missing-target' })
    expect(reopened.pptxSemantic.sourceSlides).toEqual(presentation.pptxSemantic.sourceSlides)
    const tampered = structuredClone(reopened)
    tampered.pptxSemantic.sourceSlides[1].slideId = tampered.slides[0].id
    expect(() => assertSemanticBaseline(presentation, tampered)).toThrow()
    expect(resolveRunHyperlink(reopened, { ...link, action: null })).toEqual({ status: 'disabled', reason: 'cleared' })
  })
  it('never aliases same-named slide parts and identical empty-target hashes across source packages', async () => {
    const { presentation: first } = await projectHyperlinks()
    const { presentation: foreign } = await projectHyperlinks({ url: 'https://foreign.test/source' })
    const originalLink = sourceLink(first), foreignLink = sourceLink(foreign)
    expect(foreignLink.targetPartUri).toBe(originalLink.targetPartUri)
    expect(foreign.pptxSemantic.sourceSlides[1].preconditionHash).toBe(first.pptxSemantic.sourceSlides[1].preconditionHash)
    expect(foreignLink.sourceId).not.toBe(originalLink.sourceId)
    expect(resolveRunHyperlink(first, foreignLink)).toEqual({ status: 'unresolved', reason: 'source-target-unavailable' })
  })
  it('uses code-unit package sorting and rejects malformed/ambiguous reference records', () => {
    const parts = [{ partUri: 'ppt/ä.xml', preconditionHash: 'a'.repeat(64) },
      { partUri: 'ppt/Z.xml', preconditionHash: 'b'.repeat(64) }]
    expect(sourceNamespace({ parts })).toBe(sourceNamespace({ parts: [...parts].reverse() }))
    const record = { sourceId: 'a'.repeat(64), partUri: 'ppt/slides/slide1.xml',
      preconditionHash: 'b'.repeat(64), slideId: 'slide-target' }
    expect(() => validateSourceSlides({ sourceSlides: [record] })).not.toThrow()
    for (const records of [[record, record], [{ ...record, unexpected: true }],
      [{ ...record, partUri: '../slides/slide1.xml' }], [{ ...record, sourceId: 'not-a-source' }], [[]]])
      expect(() => validateSourceSlides({ sourceSlides: records })).toThrow()
  })
})
