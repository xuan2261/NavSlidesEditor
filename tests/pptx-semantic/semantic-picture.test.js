import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pictureFixture, pixels } from './semantic-picture-fixture'
const require = createRequire(import.meta.url)
const { importPptxFile } = require('../../server/services/pptx-import/importer')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation')
const { getProjectionCapabilities } = require('../../shared/src/pptx-projection-capabilities')
const { renderSlideElements } = require('../../shared/src/element-renderers')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const {
  canonicalEditableSnapshot,
} = require('../../server/services/pptx-import/canonical-snapshot')
const {
  createPresentationSchema,
  updatePresentationSchema,
} = require('../../server/middleware/schemas')
const {
  collectTrustedImportMetadata,
  validateTrustedImportMetadata,
} = require('../../server/services/pptx-import/trusted-import-metadata')
let uploadsDir
beforeEach(async () => {
  uploadsDir = await mkdtemp(join(tmpdir(), 'semantic-picture-'))
})
afterEach(async () => {
  await rm(uploadsDir, { recursive: true, force: true })
})
function target(presentation) {
  const element = presentation.slides[0].elements[0]
  const instance = presentation.pptxSemantic.instances[element.pptxInstanceId]
  return {
    element,
    instance,
    definition: presentation.pptxSemantic.definitions[instance.definitionId],
  }
}
function edit(presentation, command) {
  const { instance, definition } = target(presentation)
  return applyPresentationProjectionOperation(presentation, {
    type: 'picture.edit',
    instanceId: instance.id,
    componentId: definition.content.pictureDocument.componentId,
    command,
  })
}
describe('source-bound picture crop and ordered alpha', () => {
  it('renders the unchanged native alpha picture with its omitted outline', async () => {
    const sourcePath = join(
      process.cwd(),
      'server/data/test-corpus/background-image-notes-footer.pptx'
    )
    const before = await readFile(sourcePath)
    const transaction = createMediaTransaction({ hashScope: {} })
    try {
      const { presentation } = await importPptxFile(sourcePath, {
        semanticImport: true,
        geometryInheritance: true,
        uploadsDir,
        mediaTransaction: transaction,
      })
      const original = JSON.stringify(presentation)
      const html = renderSlideElements(presentation.slides[0], {
        pptxSemantic: presentation.pptxSemantic,
      })
      expect(html).toContain('data-pptx-picture=')
      expect(html).toContain('slope="0.35"')
      expect(JSON.stringify(presentation)).toBe(original)
      expect(await readFile(sourcePath)).toEqual(before)
    } finally {
      await transaction.rollback()
    }
  })
  it.each([false, true])(
    'imports exact signed fractions and ordered amounts (linked=%s)',
    async (geometryInheritance) => {
      const { presentation } = await pictureFixture({ uploadsDir, geometryInheritance })
      const { definition, instance } = target(presentation)
      expect(definition.content.pictureDocument).toMatchObject({
        schemaVersion: 1,
        srcRect: { l: 500, t: -250, r: 0 },
        stretch: { fillRect: {} },
        alpha: [
          { kind: 'alphaModFix', amt: 200000 },
          { kind: 'alphaModFix', amt: 35000 },
        ],
      })
      expect(definition.content.pictureDocument.srcRect).not.toHaveProperty('b')
      expect(definition.content.media.sha256).toBe(
        createHash('sha256').update(pixels).digest('hex')
      )
      expect(
        definition.components.find((c) => c.id === definition.content.pictureDocument.componentId)
          .locator.preconditionHash
      ).toBe(definition.source.preconditionHash)
      expect(getProjectionCapabilities(presentation.pptxSemantic, instance.id).operations).toEqual([
        'picture.edit',
      ])
      const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
      expect(reopened).toEqual(presentation)
    }
  )
  it('persists sparse occurrence edits without changing source, sibling, transform or media', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const before = structuredClone(presentation)
    const { instance, definition } = target(presentation)
    let next = edit(presentation, { type: 'crop', edge: 'l', value: 750 })
    next = edit(next, {
      type: 'alpha',
      stages: [{ kind: 'alphaModFix', amt: 175000 }, { kind: 'alphaModFix' }],
    })
    const edited = target(next)
    expect(
      edited.instance.overrides.components[definition.content.pictureDocument.componentId]
    ).toEqual({
      picture: {
        srcRect: { l: 750 },
        alpha: [{ kind: 'alphaModFix', amt: 175000 }, { kind: 'alphaModFix' }],
      },
    })
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(next.slides[0].elements[1]).toEqual(before.slides[0].elements[1])
    expect(edited.instance.localTransform).toEqual(instance.localTransform)
    expect(presentation).toEqual(before)
    expect(() => assertSemanticBaseline(presentation, next)).not.toThrow()
    expect(
      normalizeSemanticPresentation(JSON.parse(JSON.stringify(canonicalEditableSnapshot(next))))
    ).toEqual(canonicalEditableSnapshot(next))
    expect(createPresentationSchema.safeParse(next).success).toBe(true)
    expect(updatePresentationSchema.safeParse(next).success).toBe(true)
    expect(await readFile(join(uploadsDir, definition.content.media.src.split('/').pop()))).toEqual(
      pixels
    )
    const reset = edit(next, { type: 'reset' })
    expect(target(reset).instance.overrides).toEqual(instance.overrides)
    expect(target(reset).element).toEqual(target(presentation).element)
  })
  it('retains omitted defaults and removes a crop edge without clamping', async () => {
    const { presentation } = await pictureFixture({
      uploadsDir,
      effects: '<a:alphaModFix/><a:alphaModFix amt="100000"/>',
      crop: '',
    })
    expect(target(presentation).definition.content.pictureDocument).not.toHaveProperty('srcRect')
    const stages = target(presentation).element.pptxPicture.alpha
    expect(stages).toEqual([{ kind: 'alphaModFix' }, { kind: 'alphaModFix', amt: 100000 }])
    const next = edit(presentation, { type: 'crop', edge: 'l', value: -500 })
    expect(target(next).element.pptxPicture.srcRect).toEqual({ l: -500 })
    const unset = edit(next, { type: 'crop', edge: 'l', value: null })
    expect(target(unset).element.pptxPicture.srcRect).toEqual({})
  })
  it('resets only crop while keeping ordered alpha edits', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    let next = edit(presentation, { type: 'crop', edge: 'l', value: 700 })
    next = edit(next, { type: 'alpha', stages: [{ kind: 'alphaModFix', amt: 25000 }] })
    next = edit(next, { type: 'reset-crop' })
    expect(target(next).element.pptxPicture.srcRect).toEqual(
      target(presentation).element.pptxPicture.srcRect
    )
    expect(target(next).element.pptxPicture.alpha).toEqual([{ kind: 'alphaModFix', amt: 25000 }])
    expect(
      target(next).instance.overrides.components[target(next).element.pptxPicture.componentId]
    ).toEqual({ picture: { alpha: [{ kind: 'alphaModFix', amt: 25000 }] } })
  })
  it('shares masked ordered alpha paint between HTML and print, leaving the outline outside alpha', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const render = (forPrint) =>
      renderSlideElements(presentation.slides[0], {
        pptxSemantic: presentation.pptxSemantic,
        forPrint,
      })
    for (const html of [render(false), render(true)]) {
      expect(html).toContain('data-pptx-picture')
      expect(html).toContain('slope="2"')
      expect(html).toContain('slope="0.35"')
      expect(html.indexOf('slope="2"')).toBeLessThan(html.indexOf('slope="0.35"'))
      expect(html).toContain('clipPath')
      expect(html).toContain('stroke:#123456')
      expect(html).not.toContain('opacity:0.7')
      expect(html).toContain('data-pptx-picture-outline')
    }
  })
  it.each([
    { type: 'crop', edge: 'l', value: 100000 },
    { type: 'crop', edge: 'l', value: 0.5 },
    { type: 'crop', edge: 'l', value: -2147483649 },
    { type: 'alpha', stages: [{ kind: 'alphaModFix', amt: -1 }] },
    { type: 'alpha', stages: [{ kind: 'alphaModFix', amt: 2147483648 }] },
    { type: 'alpha', stages: [{ kind: 'grayscl' }] },
  ])('rejects invalid edit %j atomically', async (command) => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const before = structuredClone(presentation)
    expect(() => edit(presentation, command)).toThrow()
    expect(presentation).toEqual(before)
  })
  it('rejects forged media, foreign components, locked occurrences and legacy crop writes', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    for (const mutate of [
      (p) => {
        target(p).instance.overrides.media = { src: '/uploads/other.png' }
        target(p).element.src = '/uploads/other.png'
      },
      (p) => {
        target(p).instance.overrides.components = {
          [target(p).definition.content.pictureDocument.componentId]: {
            picture: { bindingId: 'other' },
          },
        }
      },
    ]) {
      const forged = structuredClone(presentation)
      mutate(forged)
      expect(() => normalizeSemanticPresentation(forged)).toThrow()
    }
    const locked = structuredClone(presentation)
    target(locked).instance.overrides.locked = true
    expect(() => edit(locked, { type: 'crop', edge: 'l', value: 10 })).toThrow()
    const stale = structuredClone(presentation)
    Object.assign(target(stale).element, {
      cropData: { left: 0.9 },
      imageW: 3,
      opacity: 0.1,
      pptxPicture: { forged: true },
    })
    const normalized = target(normalizeSemanticPresentation(stale)).element
    expect(normalized).not.toHaveProperty('cropData')
    expect(normalized).not.toHaveProperty('imageW')
    expect(normalized).not.toHaveProperty('opacity')
    expect(normalized.pptxPicture).toEqual(target(presentation).element.pptxPicture)
  })
  it.each([
    '<a:grayscl/>',
    '<a:alphaModFix amt="-1"/>',
    '<a:alphaModFix amt="1.5"/>',
    '<a:alphaModFix extra="1"/>',
    '<a:alphaModFix amt=""/>',
  ])('fails unsupported or malformed source %s', async (effects) => {
    await expect(pictureFixture({ uploadsDir, effects })).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
  })
  it('advertises a trusted picture-only operation domain without native promotion', async () => {
    const { presentation } = await pictureFixture({ uploadsDir })
    const metadata = collectTrustedImportMetadata(presentation, 'original')
    expect(metadata.projection.operations.map((entry) => entry.operations)).toEqual([
      ['picture.edit'],
      ['picture.edit'],
    ])
    expect(() => validateTrustedImportMetadata(metadata, 'original')).not.toThrow()
  })
  it('edits one of two occurrences of the same immutable picture definition', async () => {
    const { presentation, zip } = await pictureFixture({ uploadsDir, geometryInheritance: false })
    const xml = await zip.file('ppt/slides/slide1.xml').async('string')
    const shared = structuredClone(presentation),
      { instance, element } = target(shared)
    shared.pptxSemantic.instances.copy = {
      ...structuredClone(instance),
      id: 'copy',
      paintIndex: 10,
    }
    shared.slides[0].elements.push({
      ...structuredClone(element),
      id: 'copy',
      pptxInstanceId: 'copy',
    })
    const before = normalizeSemanticPresentation(shared)
    const next = edit(before, { type: 'crop', edge: 'r', value: 500 })
    expect(next.pptxSemantic.instances.copy).toEqual(before.pptxSemantic.instances.copy)
    expect(next.slides[0].elements.at(-1)).toEqual(before.slides[0].elements.at(-1))
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(await zip.file('ppt/slides/slide1.xml').async('string')).toBe(xml)
    expect(await zip.file('ppt/media/image.png').async('nodebuffer')).toEqual(pixels)
  })
  it.each([
    { mode: 'TargetMode="External"' },
    { crop: '<a:srcRect l="500" r="99500"/>' },
    { crop: '<a:srcRect l=""/>' },
    { placement: '<a:stretch/><a:tile/>' },
    { placement: '<a:stretch extra="1"/>' },
    { outline: '<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>' },
  ])('rejects unsupported source semantics rather than stripping them: %j', async (options) => {
    await expect(pictureFixture({ uploadsDir, ...options })).rejects.toThrow()
  })
  it('preserves the authored native blur instead of discarding or rejecting its typed program', async () => {
    const { presentation } = await pictureFixture({
      uploadsDir,
      outline: '<a:effectLst><a:blur rad="100"/></a:effectLst>',
    })
    const { element } = target(presentation)
    expect(element.pptxPictureGeometry.style.effects).toEqual({
      kind: 'list', effects: [{ kind: 'blur', rad: 100 }],
    })
    expect(element.pptxPicture.srcRect).toEqual({ l: 500, t: -250, r: 0 })
    expect(element.pptxPicture.alpha).toEqual([
      { kind: 'alphaModFix', amt: 200000 }, { kind: 'alphaModFix', amt: 35000 },
    ])
    const html = renderSlideElements(presentation.slides[0], {
      pptxSemantic: presentation.pptxSemantic,
    })
    expect(html).toContain('data-pptx-geometry-blur=')
    expect(html).toContain(`<feGaussianBlur in="SourceGraphic" stdDeviation="${100 / 9525 / 3}"/>`)
    expect(html).toContain('slope="2"')
    expect(html).toContain('slope="0.35"')
  })
  it('retains tile, rotation and stretch omission without inventing source defaults', async () => {
    for (const [placement, expected] of [
      ['', {}],
      ['<a:tile tx="-200" sy="50000" algn="ctr"/>', { tile: { tx: -200, sy: 50000, algn: 'ctr' } }],
      ['<a:stretch/>', { stretch: {} }],
    ]) {
      const { presentation } = await pictureFixture({
        uploadsDir,
        placement,
        crop: '',
        effects: '',
      })
      const picture = target(presentation).definition.content.pictureDocument
      expect(picture).toMatchObject(expected)
      if (!placement) expect(picture).not.toHaveProperty('stretch')
      expect(picture).not.toHaveProperty('dpi')
      expect(picture).not.toHaveProperty('rotWithShape')
    }
  })
})
