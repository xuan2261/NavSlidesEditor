import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import { stableZip } from './feature-fixtures.js'
import renderer from '../../shared/src/element-renderers.js'
import semanticDocument from '../../shared/src/pptx-semantic-document.js'

const require = createRequire(import.meta.url)
const projectSemanticImport = (...args) =>
  require('../../server/services/pptx-import/semantic-projector').projectSemanticImport(...args)
const { importPptxFile } = require('../../server/services/pptx-import/importer')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const xfrm = (x = '-9525.5') =>
  `<a:xfrm><a:off x="${x}" y="19050.25"/><a:ext cx="914400" cy="457200"/></a:xfrm>`
const shape = (id = '2') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Not identity"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm()}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="123456"/></a:solidFill></p:spPr></p:sp>`
const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="4" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm rot="1800000" flipH="1"><a:off x="914400" y="457200"/><a:ext cx="1828800" cy="457200"/><a:chOff x="0" y="0"/><a:chExt cx="914400" cy="914400"/></a:xfrm></p:grpSpPr>${shape('5')}</p:grpSp>`
const slideXml = (content, flags = '') =>
  `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}" ${flags}><p:cSld><p:spTree>${content}</p:spTree></p:cSld></p:sld>`

async function fixture() {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.addSlide()
  pptx.addSlide()
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
  zip.file('ppt/slides/slide1.xml', slideXml(shape() + group))
  zip.file('ppt/slides/slide2.xml', slideXml(shape('9')))
  const master = 'ppt/slideMasters/slideMaster1.xml'
  zip.file(
    master,
    (await zip.file(master).async('string')).replace(
      /<p:spTree>[\s\S]*?<\/p:spTree>/,
      `<p:spTree>${shape('900')}</p:spTree>`
    )
  )
  // Sparse relationship targets and reversed presentation order are the authority.
  for (const [from, to] of [
    ['slide1', 'slide7'],
    ['slide2', 'slide3'],
  ]) {
    for (const suffix of ['.xml', '.xml.rels']) {
      const prefix = suffix.endsWith('rels') ? 'ppt/slides/_rels/' : 'ppt/slides/'
      zip.file(prefix + to + suffix, await zip.file(prefix + from + suffix).async('string'))
      zip.remove(prefix + from + suffix)
    }
  }
  const rels = 'ppt/_rels/presentation.xml.rels'
  zip.file(
    rels,
    (await zip.file(rels).async('string'))
      .replaceAll('slides/slide1.xml', 'slides/slide3.xml')
      .replaceAll('slides/slide2.xml', 'slides/slide7.xml')
  )
  const types = '[Content_Types].xml'
  zip.file(
    types,
    (await zip.file(types).async('string'))
      .replaceAll('slides/slide1.xml', 'slides/slide7.xml')
      .replaceAll('slides/slide2.xml', 'slides/slide3.xml')
  )
  for (const name of Object.keys(zip.files).filter((name) => name.endsWith('.rels'))) {
    zip.file(
      name,
      (await zip.file(name).async('string'))
        .replaceAll('slides/slide1.xml', 'slides/slide7.xml')
        .replaceAll('slides/slide2.xml', 'slides/slide3.xml')
        .replace(/<Relationship\b[^>]*Type="[^"]*\/notes(?:Slide|Master)"[^>]*\/>/g, '')
    )
  }
  zip.file(
    'ppt/presentation.xml',
    (await zip.file('ppt/presentation.xml').async('string')).replace(
      /<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/g,
      ''
    )
  )
  for (const name of Object.keys(zip.files).filter((name) => /^ppt\/theme\/.*\.xml$/.test(name))) {
    zip.file(
      name,
      (await zip.file(name).async('string')).replace(/<a:extLst>[\s\S]*?<\/a:extLst>/g, '')
    )
  }
  zip.file(
    'docProps/core.xml',
    (await zip.file('docProps/core.xml').async('string')).replace(
      /<dcterms:(created|modified)\b[^>]*>[^<]*<\/dcterms:\1>/g,
      '<dcterms:$1 xsi:type="dcterms:W3CDTF">2000-01-01T00:00:00Z</dcterms:$1>'
    )
  )
  return zip
}
const presentation = () => ({
  id: 'deck',
  slides: [
    { id: 'first', elements: [] },
    { id: 'second', elements: [] },
  ],
})

describe('source-backed semantic projection', () => {
  it('projects sparse source order, shared master definitions and local group lineage without mapper guesses', async () => {
    const result = await projectSemanticImport({
      zip: await fixture(),
      presentation: presentation(),
    })
    const semantic = result.presentation.pptxSemantic
    expect(result.presentation.pptxSlideSize).toEqual({ cx: 12192000, cy: 6858000 })
    expect(result.presentation.width).toBe(1280)
    expect(result.presentation.height).toBe(720)
    expect(result.presentation.resolution).toEqual({ width: 1280, height: 720 })
    const shared = Object.values(semantic.definitions).filter((d) => d.source.nativeId === '900')
    expect(shared).toHaveLength(1)
    expect(Object.isFrozen(shared[0])).toBe(true)
    expect(
      Object.values(semantic.instances).filter((i) => i.definitionId === shared[0].id)
    ).toHaveLength(2)
    const child = Object.values(semantic.instances).find(
      (i) => semantic.definitions[i.definitionId].source.nativeId === '5'
    )
    expect(semantic.definitions[semantic.instances[child.parentInstanceId].definitionId].kind).toBe(
      'group'
    )
    expect(child.localTransform).toEqual([1, 0, -0, 1, -9525.5, 19050.25])
    expect(
      result.presentation.slides[0].elements.some(
        (e) =>
          semantic.definitions[semantic.instances[e.pptxInstanceId].definitionId].source
            .nativeId === '9'
      )
    ).toBe(true)
    expect(
      result.presentation.slides.flatMap((s) => s.elements).some((e) => e.type === 'group')
    ).toBe(false)
    expect(result.admission.dispositions).toHaveLength(result.inventory.definitions.length)
    expect(result.admission.visualQualification).toBe('unqualified')
    expect(child.relationshipChain.length).toBeGreaterThan(0)
  })

  it('keeps negative and fractional derived coordinates and never copies writable matrices onto leaves', async () => {
    const result = await projectSemanticImport({
      zip: await fixture(),
      presentation: presentation(),
    })
    const leaf = result.presentation.slides[0].elements.find((e) =>
      e.pptxInstanceId.includes('#shape:9')
    )
    expect(leaf.width).toBe(96)
    expect(leaf.x).toBe((-9525.5 * 96) / 914400)
    expect(leaf.y).toBe((19050.25 * 96) / 914400)
    expect(leaf).not.toHaveProperty('localTransform')
    expect(leaf).not.toHaveProperty('pptxTextDocument')
  })

  it.each(['missing-transform', 'ambiguous-id', 'unknown-extension'])(
    'fails closed at the exact source location for %s without mutation',
    async (failure) => {
      const zip = await fixture()
      const part = 'ppt/slides/slide3.xml'
      let xml = await zip.file(part).async('string')
      if (failure === 'missing-transform') xml = xml.replace(/<a:xfrm>[\s\S]*?<\/a:xfrm>/, '')
      if (failure === 'ambiguous-id') xml = xml.replace('</p:spTree>', `${shape('9')}</p:spTree>`)
      if (failure === 'unknown-extension')
        xml = xml.replace('</p:sld>', '<u:data xmlns:u="urn:unsupported"/></p:sld>')
      zip.file(part, xml)
      const original = presentation()
      await expect(projectSemanticImport({ zip, presentation: original })).rejects.toThrow(
        /ppt\/slides\/slide3.xml/
      )
      expect(original).toEqual(presentation())
      expect(await zip.file(part).async('string')).toBe(xml)
    }
  )

  it('rejects unimplemented family semantics rather than declaring a raw inventory editable', async () => {
    const zip = await fixture()
    const part = 'ppt/slides/slide3.xml'
    zip.file(
      part,
      (await zip.file(part).async('string')).replace(
        '</p:spTree>',
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="88"/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="unsupported"/></a:graphic></p:graphicFrame></p:spTree>'
      )
    )
    await expect(projectSemanticImport({ zip, presentation: presentation() })).rejects.toThrow(
      /graphic-frame.*slide3.xml/
    )
  })

  it('preserves and discloses an owner-excluded source container without making its payload editable', async () => {
    const zip = await fixture(),
      part = 'ppt/slides/slide3.xml'
    const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="88"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></p:xfrm><a:graphic><a:graphicData uri="${P}/ole"><p:oleObj progId="Excel.Sheet.12"><p:embed/></p:oleObj></a:graphicData></a:graphic></p:graphicFrame>`
    zip.file(part, slideXml(frame))
    const result = await projectSemanticImport({ zip, presentation: presentation() })
    const definition = Object.values(result.presentation.pptxSemantic.definitions).find(
      (d) => d.source.nativeId === '88'
    )
    expect(definition.kind).toBe('opaque')
    expect(
      result.presentation.slides[0].elements.some((e) => e.pptxInstanceId.includes('88'))
    ).toBe(false)
    expect(
      result.admission.dispositions.filter((d) => d.disposition === 'owner-excluded-preserved')
    ).toHaveLength(2)
  })
  it('preserves slide timing as opaque source data without creating canvas elements', async () => {
    const zip = await fixture()
    const part = 'ppt/slides/slide3.xml'
    const timing =
      '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite"><p:childTnLst><p:par><p:cTn id="2"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:set><p:cBhvr><p:cTn id="3"/><p:tgtEl><p:spTgt spid="9"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr></p:set></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'
    const xml = (await zip.file(part).async('string')).replace('</p:sld>', `${timing}</p:sld>`)
    zip.file(part, xml)
    const baseline = await projectSemanticImport({ zip: await fixture(), presentation: presentation() })
    const result = await projectSemanticImport({ zip, presentation: presentation() })
    const [definitionId, definition] = Object.entries(result.presentation.pptxSemantic.definitions).find(
      ([, item]) => item.kind === 'opaque' && item.content.excludedObjects?.some((object) => object.kind === 'timing')
    ) || []
    expect(definition).toBeDefined()
    expect(definition.content.targetReferences).toHaveLength(1)
    expect(definition.content.targetReferences[0]).toEqual({
      spid: '9',
      locator: {
        path: expect.any(Array),
        preconditionHash: definition.source.preconditionHash,
      },
    })
    expect(result.admission.dispositions).toContainEqual(
      expect.objectContaining({ definitionId, disposition: 'owner-excluded-preserved' })
    )
    expect(result.presentation.slides.map((slide) => slide.elements)).toEqual(
      baseline.presentation.slides.map((slide) => slide.elements)
    )
    expect(await zip.file(part).async('string')).toBe(xml)
  })

  it('retains source-backed text runs as typed documents, including mixed native point sizes and whitespace', async () => {
    const zip = await fixture()
    const part = 'ppt/slides/slide3.xml'
    const text =
      '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1200" lang="en-US"><a:latin typeface="Arial"/></a:rPr><a:t xml:space="preserve"> Twelve </a:t></a:r><a:r><a:rPr sz="2400"/><a:t>二十四</a:t></a:r></a:p></p:txBody>'
    zip.file(part, (await zip.file(part).async('string')).replace('</p:sp>', `${text}</p:sp>`))
    const result = await projectSemanticImport({ zip, presentation: presentation() })
    const source = Object.values(result.presentation.pptxSemantic.definitions).find(
      (d) => d.source.nativeId === '9'
    )
    expect(
      source.content.textDocument.paragraphs[0].runs.map((r) => [r.text, r.properties.fontSizePt])
    ).toEqual([
      [' Twelve ', 12],
      ['二十四', 24],
    ])
    expect(source.components.filter((c) => c.kind === 'run')).toHaveLength(2)
    const body = source.components.find((c) => c.id === source.content.textDocument.componentId)
    expect(body?.locator.preconditionHash).toBe(source.source.preconditionHash)
    const edited = structuredClone(result.presentation.pptxSemantic)
    const occurrence = Object.values(edited.instances).find((i) => i.definitionId === source.id)
    occurrence.overrides.components = {
      [source.content.textDocument.componentId]: { textDocument: source.content.textDocument },
    }
    expect(() => semanticDocument.normalizePptxSemanticDocument(edited)).not.toThrow()
    expect(source.content.textDocument.paragraphs[0].runs[0].componentId).toBe(
      source.components.find((c) => c.kind === 'run').id
    )
  })

  it('suppresses hidden leaves and master instances only with exact native flags while retaining their lineage', async () => {
    const zip = await fixture()
    const part = 'ppt/slides/slide3.xml'
    zip.file(
      part,
      (await zip.file(part).async('string'))
        .replace('<p:sld ', '<p:sld showMasterSp="0" ')
        .replace('id="9"', 'id="9" hidden="1"')
    )
    const result = await projectSemanticImport({ zip, presentation: presentation() })
    expect(result.presentation.slides[0].elements.length).toBeGreaterThan(0)
    expect(result.presentation.slides[0].elements.every((e) => e.hidden === true)).toBe(true)
    const instances = Object.values(result.presentation.pptxSemantic.instances)
    expect(instances.filter((i) => i.slideId === 'first').every((i) => i.hidden === true)).toBe(
      true
    )
    expect(instances.some((i) => i.slideId === 'second' && i.hidden === false)).toBe(true)
    expect(
      renderer.renderSlideElements(result.presentation.slides[0], {
        pptxSemantic: result.presentation.pptxSemantic,
        forPrint: true,
      })
    ).toBe('')
  })

  it('renders a source-projected ordinary slide through its real semantic envelope', async () => {
    const result = await projectSemanticImport({
      zip: await fixture(),
      presentation: presentation(),
    })
    const html = renderer.renderSlideElements(result.presentation.slides[1], {
      pptxSemantic: result.presentation.pptxSemantic,
      forPrint: true,
    })
    expect(html).toContain('data-pptx-instance-id=')
    expect(html).not.toContain('left:undefinedpx')
    expect(html).not.toContain('top:undefinedpx')
  })

  it.each([false, true])(
    'uses admitted relationship-bound shared media and rejects invalid magic (invalid=%s)',
    async (invalid) => {
      const root = await mkdtemp(path.join(tmpdir(), 'semantic-picture-'))
      const transaction = createMediaTransaction({ hashScope: {} })
      try {
        const zip = await fixture()
        const part = 'ppt/slides/slide3.xml'
        const picture = (id) =>
          `<p:pic><p:nvPicPr><p:cNvPr id="${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="image&amp;shared"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm()}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
        zip.file(part, slideXml(picture('91') + picture('92')))
        const rel = 'ppt/slides/_rels/slide3.xml.rels'
        zip.file(
          rel,
          (await zip.file(rel).async('string')).replace(
            '</Relationships>',
            `<Relationship Id="image&amp;shared" Type="${R}/image" Target="../media/pixel.png"/></Relationships>`
          )
        )
        zip.file(
          'ppt/media/pixel.png',
          invalid
            ? Buffer.from('not a PNG')
            : Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
                'base64'
              )
        )
        const types = '[Content_Types].xml'
        zip.file(
          types,
          (await zip.file(types).async('string')).replace(
            '</Types>',
            '<Override PartName="/ppt/media/pixel.png" ContentType="image/png"/></Types>'
          )
        )
        const call = projectSemanticImport({
          zip,
          presentation: presentation(),
          uploadsDir: root,
          mediaTransaction: transaction,
        })
        if (invalid) {
          await expect(call).rejects.toThrow(/image admission.*slide3.xml/)
        } else {
          const result = await call
          const elements = result.presentation.slides[0].elements.filter((e) => e.type === 'image')
          expect(elements).toHaveLength(2)
          expect(elements[0].src).toBe(elements[1].src)
          const def =
            result.presentation.pptxSemantic.definitions[
              result.presentation.pptxSemantic.instances[elements[0].pptxInstanceId].definitionId
            ]
          expect(def.content.media).toMatchObject({
            partUri: 'ppt/media/pixel.png',
            relationshipId: 'image&shared',
          })
        }
      } finally {
        await transaction.rollback()
        await rm(root, { recursive: true, force: true })
      }
    }
  )

  it('runs through the real importer and leaves legacy imports without a semantic envelope', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'semantic-projector-'))
    try {
      const file = path.join(root, 'source.pptx')
      await writeFile(file, await stableZip(await fixture()))
      const result = await importPptxFile(file, { semanticImport: true, uploadsDir: root })
      expect(result.presentation.pptxSemantic.schemaVersion).toBe(1)
      expect(result.semanticAdmission.visualQualification).toBe('unqualified')
      expect(result.sourceMap.schemaVersion).toBe(1)
      const legacy = await importPptxFile(file, { uploadsDir: root })
      expect(legacy.presentation).not.toHaveProperty('pptxSemantic')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30000)
})
