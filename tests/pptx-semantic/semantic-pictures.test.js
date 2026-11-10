// @vitest-environment node
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pictureFixture } from './semantic-picture-fixture'
import importer from '../../server/services/pptx-import/importer.js'
import mediaDedup from '../../server/services/pptx-import/media-dedup.js'
import negativeFixture from '../../server/services/pptx-import/importer-picture-negative-fixture.js'
import operations from '../../shared/src/pptx-projection-operation'
import projector from '../../server/services/pptx-import/semantic-projector.js'
import pictureRenderer from '../../shared/src/pptx-picture-svg.js'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import semanticPresentation from '../../shared/src/pptx-semantic-presentation.js'
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal(),
  spawn: spawnMock,
}))


const { importPptxFile } = importer
const { createMediaTransaction } = mediaDedup
const { pictureNegativePackage, supportedPixels } = negativeFixture
const replacement = {
  kind: 'uploaded-picture',
  presentationId: 'pictures',
  filename: 'replacement.png',
  sha256: 'b'.repeat(64),
  width: 8,
  height: 4,
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const temporaryDirectories = []

async function uploadsDirectory() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-pictures-'))
  temporaryDirectories.push(root)
  const uploadsDir = path.join(root, 'uploads')
  await fs.mkdir(uploadsDir)
  return uploadsDir
}

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  spawnMock.mockReset()
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })
  ))
})

describe('PPTX picture acceptance', () => {
  it('imports an embedded SVG picture as source-bound editable paths without rasterizing it', async () => {
    const svgSource = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0L100 0L100 50Z" fill="#123456"/><path d="M10 10L90 40" fill="none" stroke="#abcdef" stroke-width="2"/></svg>'
    const { presentation, zip } = await pictureFixture({ uploadsDir: await uploadsDirectory(), svgSource,
      effects: '', crop: '', outline: '', frameGeometry: 'rect' })
    const element = presentation.slides[0].elements[0]
    const definition = presentation.pptxSemantic.definitions[presentation.pptxSemantic.instances[element.pptxInstanceId].definitionId]
    expect(definition.kind).toBe('svg')
    expect(definition.content.svgDocument).toMatchObject({
      source: { partUri: 'ppt/media/vector.svg', byteLength: Buffer.byteLength(svgSource) },
      viewBox: { x: 0, y: 0, width: 100, height: 50 },
      paths: [
        { source: { partUri: 'ppt/media/vector.svg', path: [0, 0], attribute: 'd', ordinal: 0 } },
        { source: { partUri: 'ppt/media/vector.svg', path: [0, 1], attribute: 'd', ordinal: 1 } },
      ],
    })
    expect(definition.content).not.toHaveProperty('pictureDocument')
    expect(definition.content).not.toHaveProperty('media')
    expect(element.content).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"')
    expect(element.content.match(/<path\b/g)).toHaveLength(2)
    expect(element.content).toContain('stroke-width="2"')
    expect(element.content).toMatch(/stroke:#abcdef/i)
    expect(element.content).toContain('fill:#123456')
    expect(zip.file('ppt/media/vector.svg')).not.toBeNull()
    const svgDocument = definition.content.svgDocument
    const path = svgDocument.paths[0]
    const pointId = path.geometry.paths[0].commands[0].points[0].componentId
    const before = structuredClone(presentation)
    const edited = operations.applyPresentationProjectionOperation(presentation, {
      type: 'svg.edit', instanceId: element.pptxInstanceId, componentId: svgDocument.componentId,
      command: { type: 'edit-path', pathId: path.componentId,
        geometryCommand: { type: 'control-point', componentId: pointId, x: 5 } },
    })
    expect(edited.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
    expect(edited.pptxSemantic.instances[element.pptxInstanceId].overrides.components[svgDocument.componentId]
      .familyOperations.family).toBe('svg')
    expect(edited.slides[0].elements[0].content).not.toBe(element.content)
    expect(edited.slides[0].elements[1]).toEqual(presentation.slides[0].elements[1])
    expect(presentation).toEqual(before)
  })
  it('rejects SVG picture modifiers that the typed family cannot preserve', async () => {
    const svgSource = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>'
    await expect(pictureFixture({ uploadsDir: await uploadsDirectory(), svgSource }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })
  it('preserves a 0.5 percent crop through one-occurrence replacement of shared media', async () => {
    const { presentation } = await pictureFixture({ uploadsDir: await uploadsDirectory() })
    const before = structuredClone(presentation)
    const [target, sibling] = presentation.slides[0].elements
    const edit = (deck, command) => operations.applyPresentationProjectionOperation(deck, {
      type: 'picture.edit',
      instanceId: target.pptxInstanceId,
      componentId: target.pptxPicture.componentId,
      command,
    })
    const cropped = edit(presentation, { type: 'crop', edge: 'l', value: 500 })
    const changed = edit(cropped, { type: 'replace', replacement, expectedReplacement: null })

    expect(changed.slides[0].elements[0].pptxPicture.srcRect.l).toBe(500)
    expect(changed.slides[0].elements[0].src).toBe('/uploads/replacement.png')
    expect(changed.slides[0].elements[1]).toEqual(sibling)
    expect(changed.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(changed.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(presentation).toEqual(before)
  })

  it('retains the bounded native filter/fill program on cropped pictures and applies it to image and outline together', async () => {
    const uploadsDir = await uploadsDirectory()
    const { zip } = await pictureFixture({ uploadsDir })
    const xml = await zip.file('ppt/slides/slide1.xml').async('string')
    const effects = '<a:effectLst><a:blur rad="19050" grow="0"/><a:fillOverlay blend="mult"><a:solidFill><a:srgbClr val="00FF00"><a:alpha val="50000"/></a:srgbClr></a:solidFill></a:fillOverlay></a:effectLst>'
    zip.file('ppt/slides/slide1.xml', xml.replaceAll('</p:spPr>', `${effects}</p:spPr>`))
    const { presentation } = await projector.projectSemanticImport({
      zip, uploadsDir, geometryInheritance: true,
      presentation: { id: 'pictures', title: 'Pictures', slides: [{ id: 'slide', elements: [] }] },
    })
    const [target, sibling] = presentation.slides[0].elements
    const before = structuredClone(presentation)
    expect(target.pptxPictureGeometry.style.effects).toMatchObject({
      kind: 'list', effects: [
        { kind: 'blur', rad: 19050, grow: false },
        { kind: 'fillOverlay', blend: 'mult', fill: {
          color: { kind: 'srgb', value: '00FF00', transforms: [{ kind: 'alpha', value: 50000 }] },
        } },
      ],
    })
    const changed = operations.applyPresentationProjectionOperation(presentation, {
      type: 'picture.edit', instanceId: target.pptxInstanceId,
      componentId: target.pptxPicture.componentId,
      command: { type: 'crop', edge: 'l', value: 750 },
    })
    const image = changed.slides[0].elements[0]
    expect(image.pptxPictureGeometry).toEqual(target.pptxPictureGeometry)
    expect(image.pptxOccurrenceMatrix).toEqual(target.pptxOccurrenceMatrix)
    expect(image.pptxPicture.srcRect).toEqual({ l: 750, t: -250, r: 0 })
    const svg = pictureRenderer.pictureSvg(image)
    expect(svg).toContain('feGaussianBlur')
    expect(svg).toContain('flood-color="#00FF00"')
    expect(svg).toContain('flood-opacity="0.5"')
    expect(svg).toContain('mode="multiply"')
    expect(svg).toContain('data-pptx-picture-outline="true"')
    expect(svg).toContain('stroke:#123456')
    expect(svg.indexOf('slope="2"')).toBeLessThan(svg.indexOf('slope="0.35"'))
    expect(changed.slides[0].elements[1]).toEqual(sibling)
    expect(changed.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(presentation).toEqual(before)
  })

  it('rejects unknown picture effect programs rather than dropping their paint', async () => {
    const uploadsDir = await uploadsDirectory()
    const { zip } = await pictureFixture({ uploadsDir })
    const xml = await zip.file('ppt/slides/slide1.xml').async('string')
    zip.file('ppt/slides/slide1.xml', xml.replaceAll('</p:spPr>', '<a:effectLst><a:unknownEffect/></a:effectLst></p:spPr>'))
    await expect(projector.projectSemanticImport({
      zip, uploadsDir, geometryInheritance: true,
      presentation: { id: 'pictures', slides: [{ id: 'slide', elements: [] }] },
    })).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })

  it('keeps trusted picture fill-overlay media bound and resolves it on export without mutating its source', async () => {
    const uploadsDir = await uploadsDirectory()
    const { zip } = await pictureFixture({ uploadsDir })
    const xml = await zip.file('ppt/slides/slide1.xml').async('string')
    const effect = '<a:effectLst><a:fillOverlay blend="over"><a:blipFill><a:blip r:embed="image"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></a:fillOverlay></a:effectLst>'
    zip.file('ppt/slides/slide1.xml', xml.replaceAll('</p:spPr>', `${effect}</p:spPr>`))
    const { presentation } = await projector.projectSemanticImport({
      zip, uploadsDir, geometryInheritance: true,
      presentation: { id: 'pictures', slides: [{ id: 'slide', elements: [] }] },
    })
    const element = presentation.slides[0].elements[0]
    const before = structuredClone(element)
    expect(Object.values(element.pptxEffectFillAssets)).toHaveLength(1)
    const svg = pictureRenderer.pictureSvg(element, (src) => `https://assets.example${src}`)
    expect(svg).toContain(`href="https://assets.example${element.src}"`)
    expect(svg).not.toContain('href="/uploads/')
    expect(element).toEqual(before)
  })

  it('keeps native inversion on raster colors, ordered alpha on coverage, and outline color unchanged', async () => {
    const canvas = createCanvas(100, 80)
    const context = canvas.getContext('2d')
    context.fillStyle = 'rgba(255,0,0,0.8)'
    context.fillRect(0, 0, 100, 80)
    const { presentation } = await pictureFixture({
      uploadsDir: await uploadsDirectory(), imageBytes: canvas.toBuffer('image/png'), crop: '',
      effects: '<a:alphaModFix amt="200000"/><a:inv/><a:alphaModFix amt="35000"/>',
      outline: '<a:ln w="95250"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:ln>',
    })
    const element = presentation.slides[0].elements[0]
    expect(element.pptxPicture.filters).toEqual([{ kind: 'inv' }])
    expect(element.pptxPicture.alpha).toEqual([
      { kind: 'alphaModFix', amt: 200000 }, { kind: 'alphaModFix', amt: 35000 },
    ])
    // The installed Skia SVG decoder cannot load PNG <image> nodes. Substitute
    // the identical uniform pixel field, retaining production crop/filter/mask
    // bindings. This is paint evidence, not native or browser qualification.
    const svg = pictureRenderer.pictureSvg(element)
      .replace('width="100%" height="100%"', 'width="100" height="80"')
      .replace(/<image ([^>]+)\/>/g, (_match, attributes) =>
        `<rect ${attributes.replace(/\s(?:href|preserveAspectRatio)="[^"]*"/g, '')} fill="#ff0000" fill-opacity="0.8"/>`)
    const image = await loadImage(Buffer.from(svg))
    context.clearRect(0, 0, 100, 80)
    context.drawImage(image, 0, 0)
    expect([...context.getImageData(50, 40, 1, 1).data]).toEqual([0, 255, 255, 89])
    expect([...context.getImageData(3, 40, 1, 1).data]).toEqual([18, 52, 86, 255])
    const before = structuredClone(presentation)
    const changed = operations.applyPresentationProjectionOperation(presentation, {
      type: 'picture.edit', instanceId: element.pptxInstanceId,
      componentId: element.pptxPicture.componentId,
      command: { type: 'filters', stages: [] },
    })
    expect(changed.slides[0].elements[0].pptxPicture.filters).toEqual([])
    expect(changed.slides[0].elements[0].pptxPicture.alpha).toEqual(element.pptxPicture.alpha)
    expect(changed.slides[0].elements[1]).toEqual(presentation.slides[0].elements[1])
    expect(changed.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
    expect(presentation).toEqual(before)
    expect(() => operations.applyPresentationProjectionOperation(presentation, {
      type: 'picture.edit', instanceId: element.pptxInstanceId,
      componentId: element.pptxPicture.componentId,
      command: { type: 'filters', stages: [{ kind: 'external', src: 'https://blocked.invalid/image' }] },
    })).toThrow()
    expect(presentation).toEqual(before)
    expect(semanticPresentation.normalizeSemanticPresentation(JSON.parse(JSON.stringify(changed)))).toEqual(changed)
  })

  it.each([
    '<a:inv unexpected="1"/>',
    '<a:inv><a:alphaModFix/></a:inv>',
    '<a:inv/>'.repeat(65),
  ])('rejects malformed or over-budget raster filter source atomically', async (effects) => {
    await expect(pictureFixture({ uploadsDir: await uploadsDirectory(), effects }))
      .rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
  })

  it.each(['external', 'emf'])(
    'rejects %s picture import atomically without publishing or leaking media',
    async (kind) => {
      vi.stubEnv('PPTX_SLA_STRICT', '0')
      vi.stubEnv('PPTX_SLA_STRICT_COUNT', '0')
      vi.stubEnv('PPTX_SLA_STRICT_NODES', '0')
      vi.stubEnv('PPTX_SLA_STRICT_PRIMITIVES', '0')
      vi.stubEnv('PPTX_EMF_CONVERT', '0')
      vi.stubEnv('PPTX_IMPORT_MEDIA_ORIGINS', '')
      const externalFetch = vi.fn(() => { throw new Error('External media fetch is forbidden in this test') })
      vi.stubGlobal('fetch', externalFetch)
      const uploadsDir = await uploadsDirectory()
      const file = path.join(path.dirname(uploadsDir), `${kind}.pptx`)
      const source = await pictureNegativePackage(kind)
      const originalHash = sha256(source)
      const hashScope = {}
      const transaction = createMediaTransaction({ hashScope })

      try {
        await fs.writeFile(file, source)
        const outcome = await importPptxFile(file, {
          originalName: `${kind}.pptx`,
          semanticImport: true,
          geometryInheritance: true,
          uploadsDir,
          mediaTransaction: transaction,
        }).then((result) => ({ result }), (error) => ({ error }))

        expect(outcome.error).toMatchObject({
          name: 'PptxImportError',
          code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
          status: 422,
        })
        expect(outcome).not.toHaveProperty('result')
        expect(outcome.error).not.toHaveProperty('presentation')
        expect(outcome.error).not.toHaveProperty('trustedSemanticImportMetadata')
        expect(externalFetch).not.toHaveBeenCalled()
        expect(spawnMock).not.toHaveBeenCalled()
        expect(sha256(await fs.readFile(file))).toBe(originalHash)
        const staged = await fs.readdir(uploadsDir)
        expect(staged.length).toBeGreaterThan(0)
        const supportedHash = sha256(supportedPixels)
        const stagedRecord = hashScope['pptx-import']?.[supportedHash]
        expect(stagedRecord).toMatchObject({
          filename: expect.stringMatching(/\.png$/),
          size: supportedPixels.length,
          mimeType: 'image/png',
        })
        expect(staged).toContain(stagedRecord.filename)
        expect(await fs.readFile(path.join(uploadsDir, stagedRecord.filename))).toEqual(supportedPixels)
        await transaction.rollback()
        expect(await fs.readdir(uploadsDir)).toEqual([])
        expect(sha256(await fs.readFile(file))).toBe(originalHash)
      } finally {
        await transaction.rollback()
      }
    },
    30000
  )
})
