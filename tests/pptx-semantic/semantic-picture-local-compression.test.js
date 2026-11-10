// @vitest-environment node
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import JSZip from 'jszip'
import { afterEach, expect, it, vi } from 'vitest'
import { summarizePptxImportWarnings } from '../../client/src/utils/pptx-import-summary.js'
const require = createRequire(import.meta.url)
const childProcess = require('node:child_process')
const spawn = vi.spyOn(childProcess, 'spawn')
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { readPictureSource, pictureMedia } = require('../../server/services/pptx-import/ooxml-semantic-picture')
const { validatePictureDefinition } = require('../../shared/src/pptx-picture-document')
const { pictureSvg } = require('../../shared/src/pptx-picture-svg')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const extension = '<a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext></a:extLst>'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=', 'base64')
const roots = []
afterEach(async () => {
  vi.unstubAllEnvs()
  spawn.mockReset()
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})
let cachedCorpus = null
async function corpus() {
  if (cachedCorpus) return cachedCorpus
  const sourcePath = path.join(process.cwd(), 'server/data/test-corpus/Bai_2_1.pptx')
  const bytes = await fs.readFile(sourcePath)
  const zip = await JSZip.loadAsync(bytes)
  const media = await zip.file('ppt/media/image11.emf').async('nodebuffer')
  const inventory = await buildSemanticInventory(zip)
  cachedCorpus = { zip, bytes, sourcePath, media, inventory }
  return cachedCorpus
}
it('reads the exact unchanged native slide17#8 local compression declaration with original hash and leaf ownership', async () => {
  const { zip, bytes, sourcePath, inventory } = await corpus()
  const source = inventory.definitions.find((entry) => entry.partUri === 'ppt/slides/slide17.xml' && entry.nativeId === '8')
  expect(source).toBeDefined()
  const xml = await zip.file(source.partUri).async('string')
  const roots = parseXml(xml)
  const at = (entry) => entry.componentLocators[0].path.reduce((node, index) => node.children[index], { children: roots })
  const components = inventory.definitions.filter((entry) => entry.nativeId === null && entry.partUri === source.partUri)
  const nodes = new Map(components.map((entry) => [entry.id, at(entry)]))
  const originalMedia = await zip.file('ppt/media/image11.emf').async('nodebuffer')
  const result = readPictureSource({ source, xml, node: at(source), components, nodes, geometryDeclarations: {} }, {
    partUri: 'ppt/media/image11.emf', relationshipId: 'rId2', sha256: hash(originalMedia),
  }, (_source, reason) => { throw new Error(reason) })
  expect(result.picture.useLocalDpi).toEqual({ componentId: result.dpiComponent.id, value: false })
  expect(result.picture.cstate).toBe('print')
  expect(result.picture).not.toHaveProperty('filters')
  expect(result.picture).not.toHaveProperty('dpi')
  expect(result.dpiComponent.locator.preconditionHash).toBe(hash(xml))
  const media = await pictureMedia({ zip }, 'ppt/media/image11.emf', 'rId2', '/uploads/preview.png', png)
  expect(media).toMatchObject({ sha256: hash(originalMedia), width: 1, height: 1 })
  const definition = { kind: 'image', origin: 'source', source: {
    preconditionHash: source.preconditionHash, componentLocator: source.componentLocators[0],
  }, content: { pictureDocument: result.picture, media }, components: [result.component, result.dpiComponent] }
  expect(() => validatePictureDefinition(definition)).not.toThrow()
  const forged = structuredClone(definition)
  forged.components[1].locator.path[forged.components[1].locator.path.length - 1] = 1
  expect(() => validatePictureDefinition(forged)).toThrow('local compression source locator')
  expect((await fs.readFile(sourcePath)).equals(bytes)).toBe(true)
})
async function isolated(declaration = extension) {
  const { bytes, sourcePath, media } = await corpus()
  const zip = new JSZip()
  const rels = (inner) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${inner}</Relationships>`
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="emf" ContentType="image/x-emf"/></Types>')
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels(`<Relationship Id="slide" Type="${R}/slide" Target="slides/slide17.xml"/>`))
  zip.file('ppt/slides/_rels/slide17.xml.rels', rels(`<Relationship Id="rId2" Type="${R}/image" Target="../media/image11.emf"/>`))
  zip.file('ppt/media/image11.emf', media)
  zip.file('ppt/slides/slide17.xml', `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:cSld><p:spTree><p:pic><p:nvPicPr><p:cNvPr id="8" name="Picture 2"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2" cstate="print"><a:alphaModFix amt="35000"/><a:inv/>${declaration}</a:blip><a:srcRect l="500"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="1375117" y="3795545"/><a:ext cx="7431258" cy="590047"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr></p:pic></p:spTree></p:cSld></p:sld>`)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'picture-local-compression-'))
  roots.push(root)
  const uploadsDir = path.join(root, 'uploads')
  await fs.mkdir(uploadsDir)
  const binary = path.join(root, 'magick.exe')
  await fs.writeFile(binary, 'test-only guarded spawn target')
  vi.stubEnv('PPTX_EMF_CONVERT', '1')
  vi.stubEnv('PPTX_EMF_BINARY', binary)
  vi.stubEnv('PPTX_EMF_BINARY_ROOT', root)
  vi.stubEnv('PPTX_EMF_BINARY_SHA256', hash(await fs.readFile(binary)))
  spawn.mockImplementation((_binary, args) => {
    const child = new EventEmitter()
    child.stderr = new EventEmitter()
    void fs.writeFile(args[1], png).then(() => child.emit('close', 0))
    return child
  })
  const transaction = createMediaTransaction({ hashScope: {} })
  const presentation = { id: 'native-picture', slides: [{ id: 'slide17', elements: [] }] }
  const signal = new AbortController().signal
  return { zip, media, bytes, sourcePath, transaction, mediaTransaction: transaction, uploadsDir, presentation, signal }
}
it.each(['0', '1', 'false', 'true', null])('converts guarded native EMF and retains authored local compression %s without changing paint or placement', async (lexical) => {
  const input = await isolated(lexical === null ? extension.replace(' val="0"', '') : extension.replace('val="0"', `val="${lexical}"`))
  try {
    const before = structuredClone(input.presentation)
    const result = await projectSemanticImport({ ...input, geometryInheritance: true })
    const element = result.presentation.slides[0].elements[0]
    expect(element.pptxPicture.useLocalDpi).toMatchObject(lexical === null ? {} : { value: ['1', 'true'].includes(lexical) })
    if (lexical === null) expect(element.pptxPicture.useLocalDpi).not.toHaveProperty('value')
    expect(element.pptxPicture.alpha).toEqual([{ kind: 'alphaModFix', amt: 35000 }])
    expect(element.pptxPicture.filters).toEqual([{ kind: 'inv' }])
    expect(element.pptxPicture.srcRect).toEqual({ l: 500 })
    expect(element.pptxPicture.mediaBinding.sha256).toBe(hash(input.media))
    expect(pictureSvg(element)).toContain('slope="0.35"')
    expect(result.warnings).toContainEqual(expect.objectContaining({ type: 'emf-converted-to-png', code: 'emf-converted-to-png', mediaPartUri: 'ppt/media/image11.emf', message: expect.stringContaining('not editable source vector primitives') }))
    const liveSummary = summarizePptxImportWarnings(result)
    expect(liveSummary).toContain('emf-converted-to-png (1)')
    expect(liveSummary).toContain('raster PNG preview')
    expect(liveSummary).toContain('source vector primitives are not editable')
    const durableSummary = summarizePptxImportWarnings({
      reportSummary: {
        warningCount: 1,
        byType: { 'emf-converted-to-png': 1 },
        unsupportedFeatureCount: 0,
        omittedCount: 0,
      },
    })
    expect(durableSummary).toContain('emf-converted-to-png (1)')
    expect(durableSummary).toContain('raster PNG preview')
    expect(durableSummary).toContain('source vector primitives are not editable')
    expect(spawn).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ signal: input.signal, shell: false }))
    expect(input.presentation).toEqual(before)
    expect((await fs.readFile(input.sourcePath)).equals(input.bytes)).toBe(true)
  } finally {
    await input.transaction.rollback()
    expect(await fs.readdir(input.uploadsDir)).toEqual([])
  }
})
it.each([
  extension.replace('val="0"', 'val="maybe"'),
  extension.replace('drawing/2010/main', 'drawing/2099/main'),
  extension.replace('28A0092B', '28A0092C'),
  extension.replace('</a:extLst>', `${extension.slice('<a:extLst>'.length, -'</a:extLst>'.length)}</a:extLst>`),
  extension + extension,
])('rejects malformed declaration after conversion and rolls back both assets atomically', async (declaration) => {
  const input = await isolated(declaration)
  const before = structuredClone(input.presentation)
  try {
    await expect(projectSemanticImport({ ...input, geometryInheritance: true })).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    expect(spawn).toHaveBeenCalledTimes(1)
    expect((await fs.readdir(input.uploadsDir)).length).toBe(2)
    expect(input.presentation).toEqual(before)
    expect((await fs.readFile(input.sourcePath)).equals(input.bytes)).toBe(true)
  } finally {
    await input.transaction.rollback()
    expect(await fs.readdir(input.uploadsDir)).toEqual([])
  }
})
it('retains disabled-converter rejection with no spawn or presentation publication', async () => {
  const input = await isolated()
  vi.stubEnv('PPTX_EMF_CONVERT', '0')
  const before = structuredClone(input.presentation)
  try {
    await expect(projectSemanticImport({ ...input, geometryInheritance: true })).rejects.toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' })
    expect(spawn).not.toHaveBeenCalled()
    expect(input.presentation).toEqual(before)
  } finally {
    await input.transaction.rollback()
    expect(await fs.readdir(input.uploadsDir)).toEqual([])
  }
})
