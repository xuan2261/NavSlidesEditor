import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pictureFixture } from './semantic-picture-fixture'
const require = createRequire(import.meta.url)
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { pictureSvg } = require('../../shared/src/pptx-picture-svg')
let uploadsDir
beforeEach(async () => { uploadsDir = await mkdtemp(join(tmpdir(), 'picture-replace-')) })
afterEach(async () => { await rm(uploadsDir, { recursive: true, force: true }) })
const receipt = {
  kind: 'uploaded-picture', presentationId: 'pictures', filename: 'replacement.png',
  sha256: 'b'.repeat(64), width: 8, height: 4,
}
function edit(p, command) {
  const element = p.slides[0].elements[0]
  return applyPresentationProjectionOperation(p, {
    type: 'picture.edit', instanceId: element.pptxInstanceId,
    componentId: element.pptxPicture.componentId, command,
  })
}
const replace = (p, replacement = receipt, expectedReplacement = null) =>
  edit(p, { type: 'replace', replacement, expectedReplacement })
describe('typed occurrence picture replacement', () => {
  it('separates uploaded bytes from source identity and preserves shared media occurrences', async () => {
    const { presentation: p } = await pictureFixture({ uploadsDir })
    const original = structuredClone(p)
    expect(p.slides[0].elements[0].src).toBe(p.slides[0].elements[1].src)
    const cropped = edit(p, { type: 'crop', edge: 'l', value: 750 })
    const next = replace(cropped)
    const beforeElement = cropped.slides[0].elements[0], element = next.slides[0].elements[0]
    const instance = next.pptxSemantic.instances[element.pptxInstanceId]
    expect(instance.overrides.components[element.pptxPicture.componentId].picture.replacement).toEqual(receipt)
    expect(element.src).toBe('/uploads/replacement.png')
    expect(pictureSvg(element)).toContain('href="/uploads/replacement.png"')
    expect(pictureSvg(next.slides[0].elements[1])).toContain(`href="${original.slides[0].elements[1].src}"`)
    expect(element.pptxPictureAsset).toEqual({ src: element.src, sha256: receipt.sha256, width: 8, height: 4 })
    expect(element.pptxPicture).toEqual(beforeElement.pptxPicture)
    expect(element.pptxPictureGeometry).toEqual(beforeElement.pptxPictureGeometry)
    expect(element.pptxOccurrenceMatrix).toEqual(beforeElement.pptxOccurrenceMatrix)
    expect(next.pptxSemantic.definitions).toEqual(original.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(original.pptxSemantic.styles)
    expect(next.slides[0].elements[1]).toEqual(original.slides[0].elements[1])
    expect(() => assertSemanticBaseline(p, next)).not.toThrow()
    const snapshot = canonicalEditableSnapshot(next)
    expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
    expect(p).toEqual(original)
    const reset = edit(next, { type: 'reset' })
    expect(reset.slides[0].elements[0].src).toBe(element.src)
    expect(reset.slides[0].elements[0].pptxPicture).toEqual(original.slides[0].elements[0].pptxPicture)
    const restored = edit(next, { type: 'restore-source', expectedReplacement: receipt })
    expect(restored).toEqual(cropped)
  })
  it('rejects stale replacement and restore operations without partial mutation', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const next = replace(presentation), before = structuredClone(next)
    expect(() => replace(next)).toThrow(/stale/i)
    expect(() => edit(next, { type: 'restore-source', expectedReplacement: null })).toThrow(/stale/i)
    expect(next).toEqual(before)
  })
  it('keeps a second occurrence of the exact same immutable definition on its source asset', async () => {
    const p = structuredClone((await pictureFixture({ uploadsDir })).presentation)
    const [first, second] = p.slides[0].elements
    const original = p.pptxSemantic.instances[first.pptxInstanceId]
    p.pptxSemantic.instances[second.pptxInstanceId] = {
      ...structuredClone(original), id: second.pptxInstanceId, paintIndex: 1,
    }
    const normalized = normalizeSemanticPresentation(p)
    const next = replace(normalized)
    expect(next.slides[0].elements[0].src).toBe('/uploads/replacement.png')
    expect(next.slides[0].elements[1]).toEqual(normalized.slides[0].elements[1])
    expect(next.pptxSemantic.instances[second.pptxInstanceId]).toEqual(
      normalized.pptxSemantic.instances[second.pptxInstanceId])
    expect(next.pptxSemantic.definitions).toEqual(normalized.pptxSemantic.definitions)
  })
  it('preserves a 0.5 percent crop when replacing one of two shared picture occurrences', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const originalSibling = structuredClone(presentation.slides[0].elements[1])
    const cropped = edit(presentation, { type: 'crop', edge: 'l', value: 500 })
    const next = replace(cropped)

    expect(next.slides[0].elements[0].pptxPicture.srcRect.l).toBe(500)
    expect(next.slides[0].elements[0].src).toBe('/uploads/replacement.png')
    expect(next.slides[0].elements[1]).toEqual(originalSibling)
    expect(next.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(presentation.pptxSemantic.styles)
  })
  it.each([
    { ...receipt, presentationId: 'another-deck' },
    { ...receipt, src: 'https://example.org/image.png' },
    { ...receipt, filename: '../other.png' },
    { ...receipt, filename: 'data:image/png;base64,AAA' },
    { ...receipt, filename: 'blob:foreign' },
    { ...receipt, filename: 'vector.svg' },
    { ...receipt, width: 0 },
    { ...receipt, partUri: 'ppt/media/image.png' },
    { ...receipt, relationshipId: 'rId1' },
    { ...receipt, sourceAuthority: true },
  ])('rejects malformed or foreign receipt %j atomically', async (replacement) => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const before = structuredClone(presentation)
    expect(() => replace(presentation, replacement)).toThrow()
    expect(presentation).toEqual(before)
  })
  it.each(['element', 'slide', 'instance', 'tombstone'])('rejects %s targets', async (lock) => {
    const presentation = structuredClone((await pictureFixture({ uploadsDir })).presentation)
    const element = presentation.slides[0].elements[0]
    const instance = presentation.pptxSemantic.instances[element.pptxInstanceId]
    if (lock === 'element') element.locked = true
    if (lock === 'slide') presentation.slides[0].locked = true
    if (lock === 'instance') instance.overrides.locked = true
    if (lock === 'tombstone') instance.lineage = { ...instance.lineage, tombstone: true }
    const before = structuredClone(presentation)
    expect(() => replace(presentation)).toThrow()
    expect(presentation).toEqual(before)
  })
})
