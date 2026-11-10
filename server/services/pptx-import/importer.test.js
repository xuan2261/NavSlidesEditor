import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import importer from './importer.js'

const { buildImportStats, importPptxFile } = importer
const CORPUS = path.resolve('server/data/test-corpus')

async function geometryPackage() {
  const zip = new JSZip()
  const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const relationship = (type, target, id = 'rId1') =>
    `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`
  const rels = (entries) =>
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`
  const group =
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  const shape =
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Native rectangle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="2857500" cy="1905000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="335577"/></a:solidFill></p:spPr></p:sp>'
  const namespaces = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`
  const map =
    'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"'
  zip.file('_rels/.rels', rels(relationship('officeDocument', 'ppt/presentation.xml')))
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation ${namespaces}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="master"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    rels(
      relationship('slideMaster', 'slideMasters/slideMaster1.xml', 'master') +
        relationship('slide', 'slides/slide1.xml', 'slide') +
        relationship('theme', 'theme/theme1.xml', 'theme')
    )
  )
  zip.file(
    'ppt/slides/slide1.xml',
    `<p:sld ${namespaces}><p:cSld><p:spTree>${group}${shape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    rels(relationship('slideLayout', '../slideLayouts/slideLayout1.xml'))
  )
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<p:sldLayout ${namespaces} type="blank"><p:cSld><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
  )
  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    rels(relationship('slideMaster', '../slideMasters/slideMaster1.xml'))
  )
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<p:sldMaster ${namespaces}><p:cSld><p:spTree>${group}</p:spTree></p:cSld><p:clrMap ${map}/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="layout"/></p:sldLayoutIdLst></p:sldMaster>`
  )
  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    rels(
      relationship('slideLayout', '../slideLayouts/slideLayout1.xml', 'layout') +
        relationship('theme', '../theme/theme1.xml', 'theme')
    )
  )
  const colors = [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ]
  const fonts = (kind) =>
    `<a:${kind}Font><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:${kind}Font>`
  zip.file(
    'ppt/theme/theme1.xml',
    `<a:theme xmlns:a="${A}" name="Source theme"><a:themeElements><a:clrScheme name="Source colors">${colors.map((slot) => `<a:${slot}><a:srgbClr val="335577"/></a:${slot}>`).join('')}</a:clrScheme><a:fontScheme name="Source fonts">${fonts('major')}${fonts('minor')}</a:fontScheme><a:fmtScheme name="Source format"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`
  )
  const types = [
    ['ppt/presentation.xml', 'presentation.main'],
    ['ppt/slides/slide1.xml', 'slide'],
    ['ppt/slideLayouts/slideLayout1.xml', 'slideLayout'],
    ['ppt/slideMasters/slideMaster1.xml', 'slideMaster'],
    ['ppt/theme/theme1.xml', 'theme'],
  ]
  zip.file(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>${types.map(([uri, kind]) => `<Override PartName="/${uri}" ContentType="application/vnd.openxmlformats-officedocument.${kind === 'theme' ? 'theme' : `presentationml.${kind}`}+xml"/>`).join('')}</Types>`
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('pptx importer stats boundary', () => {
  it.each([
    [undefined, 1],
    [false, 1],
    [true, 2],
  ])(
    'honors explicit geometry inheritance %s through the real import pipeline',
    async (geometryInheritance, expectedVersion) => {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-import-geometry-profile-'))
      try {
        const file = path.join(directory, 'source.pptx')
        const source = await geometryPackage()
        await fs.writeFile(file, source)
        const result = await importPptxFile(file, {
          semanticImport: true,
          geometryInheritance,
          uploadsDir: path.join(directory, 'uploads'),
        })
        expect(result.presentation.pptxSemantic.schemaVersion).toBe(expectedVersion)
        expect(result.trustedSemanticImportMetadata.schemaVersion).toBe(expectedVersion)
        expect(result.presentation.slides).toHaveLength(1)
        const definition = Object.values(result.presentation.pptxSemantic.definitions).find(
          (entry) => entry.source.nativeId === '2'
        )
        expect(definition.content.geometry.kind).toBe('preset')
        expect(definition.content.geometry.preset).toBe('rect')
        expect(definition.content.geometry.width).toBe(2857500)
        expect(await fs.readFile(file)).toEqual(source)
      } finally {
        await fs.rm(directory, { recursive: true, force: true })
      }
    },
    30000
  )
  it('exposes finite scene reconciliation counts without fallback telemetry', () => {
    const nativeObjectCoverage = {
      chartEvidenceCount: 2,
      smartArtEvidenceCount: 1,
      mappedNativeChartCount: 1,
      mappedNativeDiagramCount: 0,
      chartCoverageGapCount: 1,
      smartArtCoverageGapCount: 1,
    }
    const ooxml = {
      nativeChartCount: 2,
      nativeSmartArtCount: 1,
      slideEvidence: [{ slideIndex: 0, chartEntries: ['ppt/charts/chart1.xml'] }],
    }

    const stats = buildImportStats({
      mappedStats: {
        slideCount: 1,
        chartCount: 1,
        nativeChartCount: 2,
        nativeSmartArtCount: 1,
        nativeChartImportedCount: 1,
        nativeSmartArtImportedCount: 0,
        nativeObjectCoverage,
        ooxml,
        sceneGraphMappedNodes: 0,
        sceneGraphUnmapped: 7,
      },
      parsed: { packageVersion: '2.0.2' },
      startedAt: 10,
      now: 25,
    })

    expect(stats).toMatchObject({
      parser: 'pptxtojson',
      packageVersion: '2.0.2',
      chartCount: 1,
      nativeChartCount: 2,
      nativeSmartArtCount: 1,
      nativeChartImportedCount: 1,
      nativeSmartArtImportedCount: 0,
      nativeObjectCoverage,
      ooxml,
      sceneGraphMappedNodes: 0,
      sceneGraphUnmapped: 7,
      durationMs: 15,
    })
    expect(stats).not.toHaveProperty('fallbackParserUsed')
  })

  it('keeps the runtime import path free of fallback inspection or warnings', async () => {
    const [workerSource, importerSource, runtimeSource] = await Promise.all([
      fs.readFile(path.resolve('server/services/pptx-import/parse-worker.js'), 'utf8'),
      fs.readFile(path.resolve('server/services/pptx-import/importer.js'), 'utf8'),
      fs.readFile(path.resolve('server/services/pptx-import/pptxtojson-runtime.js'), 'utf8'),
    ])

    expect(workerSource).toContain("require('./pptxtojson-runtime')")
    expect(runtimeSource).toContain("require.resolve('pptxtojson/dist/index.cjs')")
    expect(runtimeSource).not.toContain('pptx2json')
    expect(workerSource).not.toContain('pptx2json')
    expect(workerSource).not.toContain('fallback')
    expect(importerSource).not.toContain('fallback-inspector')
    expect(importerSource).not.toContain('fallbackParserUsed')
  })

  it('forwards source-map identity through the production importer boundary', async () => {
    const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-import-source-map-'))
    try {
      const imported = await importPptxFile(path.join(CORPUS, 'math-rich-text.pptx'), {
        originalName: 'math-rich-text.pptx',
        uploadsDir,
        sourceMapIdentity: {
          presentationId: 'forwarded-deck',
          revisionId: 'r0',
          packageGeneration: 9,
        },
      })

      expect(imported.sourceMap).toMatchObject({
        presentationId: 'forwarded-deck',
        revisionId: 'r0',
        packageGeneration: 9,
      })
    } finally {
      await fs.rm(uploadsDir, { recursive: true, force: true })
    }
  })
})
