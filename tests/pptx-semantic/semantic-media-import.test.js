import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createSemanticMediaFixture as fixture } from './semantic-media-fixture.js'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { renderSlideElements } = require('../../shared/src/element-renderers')
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')

const presentation = () => ({ id: 'media-deck', slides: [{ id: 'slide', elements: [] }] })

async function withUploads(run) {
  const uploadsDir = await mkdtemp(path.join(tmpdir(), 'navslides-media-semantic-'))
  try {
    return await run(uploadsDir)
  } finally {
    await rm(uploadsDir, { recursive: true, force: true })
  }
}
async function snapshotZip(zip) {
  return new Map(await Promise.all(Object.values(zip.files).filter(entry => !entry.dir)
    .map(async entry => [entry.name, await entry.async('nodebuffer')])))
}
async function assertZipUnchanged(zip, before) {
  expect(Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name).sort())
    .toEqual([...before.keys()].sort())
  for (const [name, bytes] of before) expect(await zip.file(name).async('nodebuffer'), name).toEqual(bytes)
}

describe('source-bound semantic media import', () => {
  it('projects source milliseconds to playback seconds through save, reopen and shared rendering', async () => {
    await withUploads(async (uploadsDir) => {
      const zip = await fixture({ trimEnd: '2500.25', durationSeconds: 4 })
      const sourceXml = await zip.file('ppt/slides/slide1.xml').async('string')
      const { presentation: imported } = await projectSemanticImport({
        zip, presentation: presentation(), uploadsDir,
      })
      const saved = canonicalEditableSnapshot(imported)
      const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(saved)))
      const element = reopened.slides[0].elements[0]
      expect(element).toMatchObject({ startTime: 1.0005, endTime: 2.50025 })
      const html = renderSlideElements(reopened.slides[0], { pptxSemantic: reopened.pptxSemantic })
      expect(html).toContain('&quot;startTime&quot;:1.0005')
      expect(html).toContain('&quot;endTime&quot;:2.50025')
      const instance = reopened.pptxSemantic.instances[element.pptxInstanceId]
      const source = reopened.pptxSemantic.definitions[instance.definitionId].content.mediaDocument
      const edited = applyPresentationProjectionOperation(reopened, {
        type: 'media.edit', instanceId: instance.id, componentId: source.embeddedComponentId,
        command: { type: 'set-playback', playback: { startTime: 1.25, endTime: 2, loop: true } },
      })
      const editedReopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(canonicalEditableSnapshot(edited))))
      expect(editedReopened.slides[0].elements[0]).toMatchObject({ startTime: 1.25, endTime: 2, loop: true })
      expect(() => assertSemanticBaseline(imported, editedReopened)).not.toThrow()
      expect(editedReopened.pptxSemantic.definitions).toEqual(imported.pptxSemantic.definitions)
      expect(await zip.file('ppt/slides/slide1.xml').async('string')).toBe(sourceXml)
    })
  })

  it('imports an embedded audio asset, poster and native trim declarations as typed records', async () => {
    await withUploads(async (uploadsDir) => {
      const zip = await fixture()
      const sourceXml = await zip.file('ppt/slides/slide1.xml').async('string')
      const result = await projectSemanticImport({
        zip,
        presentation: presentation(),
        uploadsDir,
      })
      const element = result.presentation.slides[0].elements[0]
      const definition = result.presentation.pptxSemantic.definitions[
        result.presentation.pptxSemantic.instances[element.pptxInstanceId].definitionId
      ]

      expect(element).toMatchObject({ type: 'audio', autoplay: false, loop: false, muted: false })
      expect(element.src).toMatch(/^\/uploads\/.+\.wav$/)
      expect(element.poster).toMatch(/^\/uploads\/.+\.png$/)
      expect(definition.kind).toBe('audio')
      expect(definition.content.mediaDocument).toMatchObject({
        schemaVersion: 1,
        mediaType: 'audio',
        asset: {
          partUri: 'ppt/media/audio.wav',
          legacyRelationshipId: 'rIdLegacy',
          embeddedRelationshipId: 'rIdMedia',
        },
        trim: { startMs: 1000.5, endMs: 250.25 },
        poster: { partUri: 'ppt/media/poster.png', relationshipId: 'rIdPoster' },
      })
      expect(definition.components.filter((component) => component.kind === 'media-segment')).toHaveLength(2)
      expect(normalizePptxSemanticDocument(result.presentation.pptxSemantic)).toEqual(
        result.presentation.pptxSemantic
      )
      expect(await zip.file('ppt/slides/slide1.xml').async('string')).toBe(sourceXml)
    })
  })

  it.each([
    ['external media relationship', { external: true }, /external|media relationship/i],
    ['negative trim', { malformedTrim: true }, /trim/i],
  ])('rejects %s without mutating the caller presentation', async (_label, options, message) => {
    await withUploads(async (uploadsDir) => {
      const original = presentation()
      await expect(
        projectSemanticImport({ zip: await fixture(options), presentation: original, uploadsDir })
      ).rejects.toThrow(message)
      expect(original).toEqual(presentation())
    })
  })

  it('preserves an external-link-only media picture without fetching its origin', async () => {
    await withUploads(async (uploadsDir) => {
      const zip = await fixture({ externalLinkOnly: true, mediaType: 'video' })
      const sourceXml = await zip.file('ppt/slides/slide1.xml').async('string')
      const { presentation: imported } = await projectSemanticImport({
        zip, presentation: presentation(), uploadsDir, geometryInheritance: true,
      })
      expect(imported.slides[0]).toEqual({
        id: 'slide',
        elements: [],
        pptxSlideSource: {
          definitionIds: [
            'ppt/slides/slide1.xml#slide-metadata:0',
            'ppt/slideLayouts/slideLayout1.xml#slide-metadata:0',
            'ppt/slideMasters/slideMaster1.xml#slide-metadata:0',
          ],
        },
      })
      const definitions = Object.values(imported.pptxSemantic.definitions)
      const preserved = definitions.find((definition) => definition.kind === 'opaque')
      expect(preserved.content.excludedObjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'media-segment',
            attributes: expect.objectContaining({ externalTarget: 'https://blocked.invalid/video.mp4' }),
          }),
        ])
      )
      expect(definitions.some((definition) =>
        definition.content?.mediaDocument || definition.kind === 'audio' || definition.kind === 'video'
      )).toBe(false)
      expect(JSON.stringify(preserved)).toContain('https://blocked.invalid/video.mp4')
      expect(definitions.some((definition) =>
        JSON.stringify(definition).includes('blocked.invalid')
      )).toBe(true)
      expect(await zip.file('ppt/slides/slide1.xml').async('string')).toBe(sourceXml)
    })
  })

  it.each([
    ['missing audio file', (zip) => { zip.remove('ppt/media/audio.wav') }, /missing.*media|part/i],
    ['missing poster file', (zip) => { zip.remove('ppt/media/poster.png') }, /missing.*poster|part/i],
  ])('rejects %s without screenshot substitution or presentation mutation', async (_label, mutate, message) => {
    await withUploads(async (uploadsDir) => {
      const zip = await fixture()
      mutate(zip)
      const beforeZip = await snapshotZip(zip)
      const original = presentation()
      const originalBefore = structuredClone(original)
      await expect(
        projectSemanticImport({ zip, presentation: original, uploadsDir })
      ).rejects.toThrow(message)
      expect(original).toEqual(originalBefore)
      await assertZipUnchanged(zip, beforeZip)
    })
  })

  it('audits media asset and poster hashes against package bytes without modifying source', async () => {
    await withUploads(async (uploadsDir) => {
      const zip = await fixture({ durationSeconds: 2 })
      const beforeZip = await snapshotZip(zip)
      const audioBytes = beforeZip.get('ppt/media/audio.wav')
      const posterBytes = beforeZip.get('ppt/media/poster.png')
      const audioHash = createHash('sha256').update(audioBytes).digest('hex')
      const posterHash = createHash('sha256').update(posterBytes).digest('hex')
      const caller = presentation(), callerBefore = structuredClone(caller)
      const { presentation: imported, inventory, admission } = await projectSemanticImport({
        zip, presentation: caller, uploadsDir,
      })
      expect(caller).toEqual(callerBefore)
      await assertZipUnchanged(zip, beforeZip)
      expect(admission.visualQualification).toBe('unqualified')
      const mediaDef = Object.values(imported.pptxSemantic.definitions).find(d => d.kind === 'audio')
      expect(mediaDef.content.mediaDocument.asset.sha256).toBe(audioHash)
      expect(mediaDef.content.mediaDocument.poster.sha256).toBe(posterHash)
      const audioPart = inventory.parts.find(p => p.partUri === 'ppt/media/audio.wav')
      const posterPart = inventory.parts.find(p => p.partUri === 'ppt/media/poster.png')
      expect(audioPart.preconditionHash).toBe(audioHash)
      expect(posterPart.preconditionHash).toBe(posterHash)
    })
  })
})
