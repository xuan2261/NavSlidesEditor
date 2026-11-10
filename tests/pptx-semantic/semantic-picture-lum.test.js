// @vitest-environment node
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import { pictureFixture } from './semantic-picture-fixture'

const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { readPictureSource } = require('../../server/services/pptx-import/ooxml-semantic-picture')
const {
  pictureParameters,
  validatePictureDefinition,
} = require('../../shared/src/pptx-picture-document')
const { pictureSvg } = require('../../shared/src/pptx-picture-svg')

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const temporaryDirectories = []

async function makeUploadsDir() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-picture-lum-'))
  temporaryDirectories.push(root)
  const uploadsDir = path.join(root, 'uploads')
  await fs.mkdir(uploadsDir)
  return uploadsDir
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((d) => fs.rm(d, { recursive: true, force: true }))
  )
})

describe('picture luminance effect (<a:lum>) semantics, validation, and browser projection', () => {
  it('parses native Bai_2_1 slide31#8 lum bright20000 contrast20000 cleanly into semantic picture model', async () => {
    const corpusPath = path.join(process.cwd(), 'server/data/test-corpus/Bai_2_1.pptx')
    const bytes = await fs.readFile(corpusPath)
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('ppt/slides/slide31.xml').async('string')
    const roots = parseXml(xml)

    // Locate the exact pic node id=8 in slide31
    const at = (p) => p.reduce((node, idx) => node.children[idx], { children: roots })
    // In slide31.xml: p:sld -> p:cSld -> p:spTree -> grpSp (index 6) -> pic (index 2)
    // path from roots: [0, 0, 0, 6, 2]
    const picNode = at([0, 0, 0, 6, 2])
    expect(picNode.local).toBe('pic')

    const source = {
      id: 'ppt/slides/slide31.xml#pic:8',
      partUri: 'ppt/slides/slide31.xml',
      nativeId: '8',
      componentLocators: [{ path: [0, 0, 0, 6, 2] }],
      preconditionHash: hash(xml),
    }

    const media = {
      partUri: 'ppt/media/image31.emf',
      relationshipId: 'rId2',
      sha256: hash(Buffer.from('test-media-binding')),
    }

    const result = readPictureSource(
      { source, xml, node: picNode, components: [], nodes: new Map() },
      media,
      (_src, reason) => { throw new Error(reason) }
    )

    expect(result.picture.filters).toEqual([
      { kind: 'lum', bright: 20000, contrast: 20000 },
    ])
    expect(result.picture.rotWithShape).toBe(true)
    expect(result.picture.srcRect).toEqual({ t: 8233, b: 5701 })

    // Validates in picture document schema
    const definition = {
      kind: 'image',
      origin: 'source',
      source: {
        preconditionHash: source.preconditionHash,
        componentLocator: source.componentLocators[0],
      },
      content: {
        pictureDocument: result.picture,
        media: { partUri: media.partUri, relationshipId: media.relationshipId, src: '/uploads/pic.png', sha256: media.sha256, width: 100, height: 100 },
      },
      components: [result.component],
    }
    expect(() => validatePictureDefinition(definition)).not.toThrow()
  })

  it('validates lum filter schema within integer bounds [-100000, 100000] and rejects out-of-range or malformed values', () => {
    const base = {
      schemaVersion: 1,
      componentId: 'picture:test',
      mediaBinding: { partUri: 'ppt/media/image1.png', relationshipId: 'rId1', sha256: 'a'.repeat(64) },
      alpha: [],
    }

    // Accepts valid lum filter
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', bright: 20000, contrast: 20000 }] })).not.toThrow()
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', bright: -100000, contrast: 100000 }] })).not.toThrow()
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum' }] })).not.toThrow()
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', bright: 0 }] })).not.toThrow()

    // Rejects out-of-bounds bright
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', bright: 100001 }] })).toThrow(/native integer/)
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', bright: -100001 }] })).toThrow(/native integer/)

    // Rejects out-of-bounds contrast
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', contrast: 100001 }] })).toThrow(/native integer/)
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', contrast: -100001 }] })).toThrow(/native integer/)

    // Rejects non-integer values
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', bright: 20000.5 }] })).toThrow(/native integer/)
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', bright: '20000' }] })).toThrow(/native integer/)

    // Rejects unexpected fields
    expect(() => pictureParameters({ ...base, filters: [{ kind: 'lum', unknown: 1 }] })).toThrow(/record fields/)
  })

  it('reader enforces integer syntax, allowed attributes, and empty child element budget on <a:lum>', () => {
    const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

    function parse(lumSnippet) {
      const xml = `<p:pic xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:nvPicPr><p:cNvPr id="1" name="P"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1">${lumSnippet}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
      const roots = parseXml(xml)
      const source = {
        id: 'pic:1',
        partUri: 'ppt/slides/slide1.xml',
        nativeId: '1',
        componentLocators: [{ path: [0] }],
        preconditionHash: hash(xml),
      }
      const media = { partUri: 'ppt/media/image.png', relationshipId: 'rId1', sha256: 'a'.repeat(64) }
      return readPictureSource(
        { source, xml, node: roots[0], components: [], nodes: new Map() },
        media,
        (_s, reason) => { throw new Error(reason) }
      )
    }

    // Accepts valid attributes
    expect(parse('<a:lum bright="20000" contrast="20000"/>').picture.filters).toEqual([
      { kind: 'lum', bright: 20000, contrast: 20000 },
    ])
    expect(parse('<a:lum bright="-50000"/>').picture.filters).toEqual([
      { kind: 'lum', bright: -50000 },
    ])
    expect(parse('<a:lum contrast="50000"/>').picture.filters).toEqual([
      { kind: 'lum', contrast: 50000 },
    ])
    expect(parse('<a:lum/>').picture.filters).toEqual([{ kind: 'lum' }])

    // Rejects non-integer attribute syntax
    expect(() => parse('<a:lum bright="invalid"/>')).toThrow(/native bright/)
    expect(() => parse('<a:lum contrast="12.34"/>')).toThrow(/native contrast/)

    // Rejects out-of-range integer via schema check
    expect(() => parse('<a:lum bright="200000"/>')).toThrow(/native integer/)

    // Rejects unexpected attributes
    expect(() => parse('<a:lum bright="20000" unsupported="1"/>')).toThrow(/unsupported\/malformed source/)

    // Rejects unexpected children inside <a:lum>
    expect(() => parse('<a:lum bright="20000"><a:extLst/></a:lum>')).toThrow(/unsupported\/malformed source/)
  })

  it('renders linear SVG feComponentTransfer as browser projection approximation and never asserts native equivalence', () => {
    // Note: In native PowerPoint, DrawingML <a:lum> luminance adjustments use non-linear
    // contrast curves rather than hard-clipping linear SVG slope. This test explicitly
    // asserts the deterministic browser projection output while acknowledging that native
    // pixel qualification remains open.
    const element = {
      type: 'shape',
      pptxInstanceId: 'slide1#pic:1',
      alt: 'Test picture',
      pptxPicture: {
        schemaVersion: 1,
        componentId: 'picture:pic:1',
        mediaBinding: { partUri: 'ppt/media/image1.png', relationshipId: 'rId1', sha256: 'a'.repeat(64) },
        alpha: [],
        filters: [{ kind: 'lum', bright: 20000, contrast: 20000 }],
      },
      pptxPictureGeometry: {
        schemaVersion: 1,
        componentId: 'geom1',
        kind: 'preset',
        preset: 'rect',
        width: 952500,
        height: 762000,
        adjustments: [],
        guides: [],
        handles: [],
        paths: [
          {
            componentId: 'outline',
            commands: [
              { kind: 'moveTo', points: [{ componentId: 'p0', x: 0, y: 0 }] },
              { kind: 'lnTo', points: [{ componentId: 'p1', x: 100, y: 0 }] },
              { kind: 'lnTo', points: [{ componentId: 'p2', x: 100, y: 80 }] },
              { kind: 'lnTo', points: [{ componentId: 'p3', x: 0, y: 80 }] },
              { kind: 'close' },
            ],
          },
        ],
      },
      pptxOccurrenceMatrix: [1, 0, 0, 1, 0, 0],
      pptxPictureAsset: { src: '/uploads/image1.png', width: 100, height: 80 },
    }

    const svg = pictureSvg(element)

    // For bright = 20000 (0.2) and contrast = 20000 (0.2):
    // slope = 1 + contrast = 1.2
    // intercept = bright - 0.5 * contrast = 0.2 - 0.1 = 0.1
    expect(svg).toContain('<feComponentTransfer>')
    expect(svg).toContain('<feFuncR type="linear" slope="1.2" intercept="0.1"/>')
    expect(svg).toContain('<feFuncG type="linear" slope="1.2" intercept="0.1"/>')
    expect(svg).toContain('<feFuncB type="linear" slope="1.2" intercept="0.1"/>')

    // For negative brightness and contrast:
    const negativeElement = {
      ...element,
      pptxPicture: {
        ...element.pptxPicture,
        filters: [{ kind: 'lum', bright: -20000, contrast: -20000 }],
      },
    }
    const negativeSvg = pictureSvg(negativeElement)
    // slope = 1 + (-0.2) = 0.8
    // intercept = -0.2 - 0.5 * (-0.2) = -0.2 + 0.1 = -0.1
    expect(negativeSvg).toContain('<feFuncR type="linear" slope="0.8" intercept="-0.1"/>')
  })

  it('imports fixture with <a:lum> end-to-end preserving authored filter in element and presentation projection', async () => {
    const uploadsDir = await makeUploadsDir()
    const { presentation } = await pictureFixture({
      uploadsDir,
      effects: '<a:lum bright="20000" contrast="20000"/>',
      crop: '',
      outline: '',
    })

    const element = presentation.slides[0].elements[0]
    expect(element.pptxPicture.filters).toEqual([
      { kind: 'lum', bright: 20000, contrast: 20000 },
    ])

    const renderedSvg = pictureSvg(element)
    expect(renderedSvg).toContain('slope="1.2" intercept="0.1"')
  })
})
