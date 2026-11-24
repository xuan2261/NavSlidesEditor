import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const {
  readTheme3dAppearance,
  projectTheme3dAppearance,
} = require('../../server/services/pptx-import/ooxml-theme-3d-appearance')

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

// The frozen 3D appearance declarations present in STTre_Duc theme1/2/3 under effectStyleLst/effectStyle[2]
const sttreDucScene = '<a:scene3d><a:camera prst="orthographicFront"><a:rot lat="0" lon="0" rev="0"/></a:camera><a:lightRig rig="threePt" dir="t"><a:rot lat="0" lon="0" rev="1200000"/></a:lightRig></a:scene3d>'
const sttreDucSp3d = '<a:sp3d><a:bevelT w="63500" h="25400"/></a:sp3d>'
const outerShdw = '<a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw>'

function themeXml(effects = `<a:effectLst>${outerShdw}</a:effectLst>${sttreDucScene}${sttreDucSp3d}`) {
  return `<a:theme xmlns:a="${A}" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:srgbClr val="000000"/></a:dk1></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle>${effects}</a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`
}

function parseTheme(xml, partUri = 'ppt/theme/theme1.xml') {
  const preconditionHash = createHash('sha256').update(xml).digest('hex')
  const roots = parseXml(xml)
  return { partUri, xml, roots, preconditionHash }
}

describe('theme 3D appearance preservation and strict admission', () => {
  it('parses frozen STTre_Duc theme 3D appearance with exact provenance and no render claims', () => {
    const xml = themeXml()
    const parsed = parseTheme(xml)
    const result = readTheme3dAppearance(parsed)

    expect(result).not.toBeNull()
    expect(result.appearances).toHaveLength(1)

    const app = result.appearances[0]
    expect(app.schemaVersion).toBe(1)
    expect(app.partUri).toBe('ppt/theme/theme1.xml')
    expect(app.effectStyleIndex).toBe(2)
    expect(app.effectStyleLocator.path).toEqual([0, 0, 2, 2, 2])

    // scene3d under 0.0.2.2.2.1
    expect(app.scene).toBeDefined()
    expect(app.scene.componentId).toBe('ppt/theme/theme1.xml#property:0.0.2.2.2.1')
    expect(app.scene.source.partUri).toBe('ppt/theme/theme1.xml')
    expect(app.scene.source.componentLocator.path).toEqual([0, 0, 2, 2, 2, 1])
    expect(app.scene.source.preconditionHash).toBe(parsed.preconditionHash)
    expect(app.scene.value).toMatchObject({
      kind: 'scene3d',
      camera: {
        value: {
          kind: 'camera',
          prst: 'orthographicFront',
          rotation: { value: { kind: 'rot', lat: 0, lon: 0, rev: 0 } },
        },
      },
      lightRig: {
        value: {
          kind: 'lightRig',
          rig: 'threePt',
          dir: 't',
          rotation: { value: { kind: 'rot', lat: 0, lon: 0, rev: 1200000 } },
        },
      },
    })

    // sp3d under 0.0.2.2.2.2
    expect(app.shape).toBeDefined()
    expect(app.shape.componentId).toBe('ppt/theme/theme1.xml#property:0.0.2.2.2.2')
    expect(app.shape.source.partUri).toBe('ppt/theme/theme1.xml')
    expect(app.shape.source.componentLocator.path).toEqual([0, 0, 2, 2, 2, 2])
    expect(app.shape.source.preconditionHash).toBe(parsed.preconditionHash)
    expect(app.shape.value).toMatchObject({
      kind: 'sp3d',
      bevelTop: {
        value: {
          kind: 'bevelT',
          w: 63500,
          h: 25400,
        },
      },
    })

    // Preserved unrendered warnings without native/render claims
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings.every((w) =>
      w.type === '3d-appearance-preserved-unrendered' &&
      w.partUri === 'ppt/theme/theme1.xml' &&
      w.message.includes('preserved but not rendered')
    )).toBe(true)
  })

  it.each([
    ['unknown scene child', sttreDucScene.replace('</a:scene3d>', '<a:unknown/></a:scene3d>') + sttreDucSp3d],
    ['duplicate camera', sttreDucScene.replace('<a:lightRig', '<a:camera prst="orthographicFront"/><a:lightRig') + sttreDucSp3d],
    ['missing camera', '<a:scene3d><a:lightRig rig="threePt" dir="t"/></a:scene3d>' + sttreDucSp3d],
    ['wrong ordering in scene3d', '<a:scene3d><a:lightRig rig="threePt" dir="t"/><a:camera prst="orthographicFront"/></a:scene3d>' + sttreDucSp3d],
    ['invalid camera enum', sttreDucScene.replace('orthographicFront', 'invalidCam') + sttreDucSp3d],
    ['invalid light enum', sttreDucScene.replace('rig="threePt"', 'rig="invalidRig"') + sttreDucSp3d],
    ['invalid direction', sttreDucScene.replace('dir="t"', 'dir="north"') + sttreDucSp3d],
    ['invalid rotation angle', sttreDucScene.replace('rev="1200000"', 'rev="-5"') + sttreDucSp3d],
    ['unknown attribute on bevelT', sttreDucScene + sttreDucSp3d.replace('w="63500"', 'unknown="1"')],
    ['invalid coordinate on bevelT', sttreDucScene + sttreDucSp3d.replace('63500', '-1')],
    ['wrong namespace on camera', sttreDucScene.replace('<a:camera', '<bad:camera xmlns:bad="urn:wrong"').replace('</a:camera>', '</bad:camera>') + sttreDucSp3d],
    ['unexpected text inside scene3d', sttreDucScene.replace('<a:scene3d>', '<a:scene3d>unwanted text') + sttreDucSp3d],
    ['duplicate scene3d root', sttreDucScene + sttreDucScene],
    ['out of order roots (sp3d before scene3d)', sttreDucSp3d + sttreDucScene],
  ])('strictly rejects malformed %s in theme 3D appearance without silent discarding', (_name, appearance) => {
    const xml = themeXml(`<a:effectLst/>${appearance}`)
    const parsed = parseTheme(xml)
    expect(() => readTheme3dAppearance(parsed)).toThrow()
  })

  it('projectTheme3dAppearance maps inventoried definitions and registers dispositions', () => {
    const xml = themeXml()
    const parsed = parseTheme(xml)
    const partUri = 'ppt/theme/theme1.xml'

    const inventory = {
      parts: [{ partUri, preconditionHash: parsed.preconditionHash }],
      definitions: [
        {
          id: `${partUri}#property:0.0.2.2.2.1`,
          partUri,
          localName: 'scene3d',
          kind: 'property',
          componentLocators: [{ path: [0, 0, 2, 2, 2, 1], preconditionHash: parsed.preconditionHash }],
          disposition: 'requires-mapping',
        },
        {
          id: `${partUri}#property:0.0.2.2.2.2`,
          partUri,
          localName: 'sp3d',
          kind: 'property',
          componentLocators: [{ path: [0, 0, 2, 2, 2, 2], preconditionHash: parsed.preconditionHash }],
          disposition: 'requires-mapping',
        },
      ],
    }

    const parts = new Map([[partUri, { xml, roots: parsed.roots }]])
    const nodes = new Map()
    const dispositions = new Map()
    const warnings = []
    const fail = (source, message) => {
      throw new Error(`Projector failed on ${source?.id}: ${message}`)
    }

    const result = projectTheme3dAppearance({
      inventory,
      parts,
      nodes,
      dispositions,
      fail,
      warnings,
    })

    expect(result.mappedAppearances).toHaveLength(1)
    expect(dispositions.has(`${partUri}#property:0.0.2.2.2.1`)).toBe(true)
    expect(dispositions.get(`${partUri}#property:0.0.2.2.2.1`)).toEqual({
      definitionId: `${partUri}#property:0.0.2.2.2.1`,
      partUri,
      locator: { path: [0, 0, 2, 2, 2, 1], preconditionHash: parsed.preconditionHash },
      disposition: 'semantically-mapped',
    })

    expect(dispositions.has(`${partUri}#property:0.0.2.2.2.2`)).toBe(true)
    expect(dispositions.get(`${partUri}#property:0.0.2.2.2.2`)).toEqual({
      definitionId: `${partUri}#property:0.0.2.2.2.2`,
      partUri,
      locator: { path: [0, 0, 2, 2, 2, 2], preconditionHash: parsed.preconditionHash },
      disposition: 'semantically-mapped',
    })

    expect(warnings).toHaveLength(2)
  })

  it('imports package with STTre_Duc theme 3D appearance end-to-end with mapped dispositions and unrendered warnings', async () => {
    const { fixture, slide, layout, master } = await import('./semantic-text-style-context-fixture')
    const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
    const zip = await fixture()
    for (const part of [slide, layout, master])
      zip.file(
        part,
        (await zip.file(part).async('string')).replaceAll(
          '<p:spPr/>',
          '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
        )
      )
    zip.file('ppt/presentation.xml', (await zip.file('ppt/presentation.xml').async('string')).replace(
      '</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
    ))
    const xml = themeXml()
    zip.file('ppt/theme/not-indexed.xml', xml)
    const result = await projectSemanticImport({
      zip,
      geometryInheritance: true,
      presentation: { title: 'Theme 3D Test', slides: [{ id: 's1', elements: [] }] },
    })
    expect(result.admission.dispositions.some((d) => d.definitionId === 'ppt/theme/not-indexed.xml#property:0.0.2.2.2.1')).toBe(true)
    expect(result.admission.dispositions.some((d) => d.definitionId === 'ppt/theme/not-indexed.xml#property:0.0.2.2.2.2')).toBe(true)
    expect(result.warnings.some((w) => w.type === '3d-appearance-preserved-unrendered' && w.partUri === 'ppt/theme/not-indexed.xml')).toBe(true)
  })
})
