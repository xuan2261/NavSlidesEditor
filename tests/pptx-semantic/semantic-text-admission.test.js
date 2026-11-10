import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { resolveProperty } = require('../../shared/src/pptx-style-resolution')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { readSemanticTextAdmission } = require('../../server/services/pptx-import/ooxml-semantic-text-admission')
async function source() {
  const zip = await fixture()
  for (const part of [slide, layout, master])
    zip.file(
      part,
      (await zip.file(part).async('string')).replaceAll(
        '<p:spPr/>',
        '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
      )
    )
  const part = 'ppt/presentation.xml'
  zip.file(part, (await zip.file(part).async('string')).replace(
    '</p:presentation>', '<p:sldSz cx="9144000" cy="5143500"/></p:presentation>'
  ))
  return zip
}
const project = (zip) => projectSemanticImport({
  zip, geometryInheritance: true,
  presentation: { id: 'deck', slides: [{ id: 'slide', elements: [] }] },
})

describe('production semantic text admission', () => {
  it('admits the sealed master date source list without modifying the package', async () => {
    const bytes = await readFile('.omo/evidence/pptx-semantic/resume-path-gradient-domain-focus-reference/path-gradient-reference.pptx')
    const hash = () => createHash('sha256').update(bytes).digest('hex')
    expect(hash()).toBe('93905a0f04c9e91376f5cbe3a7bb7a61e75e4127a6e23e0848e9cd0714b528f3')
    const zip = await JSZip.loadAsync(bytes)
    const inventory = await buildSemanticInventory(zip)
    const part = 'ppt/slideMasters/slideMaster1.xml'
    const xml = await zip.file(part).async('string')
    const roots = parseXml(xml), nodes = new Map()
    for (const item of inventory.definitions.filter((d) => d.partUri === part)) {
      let node = { children: roots }
      for (const i of item.componentLocators[0].path) node = node.children[i]
      nodes.set(item.id, node)
    }
    const source = inventory.definitions.find((d) => d.id === `${part}#shape:4`)
    const result = readSemanticTextAdmission({
      source, node: nodes.get(source.id), xml, nodes,
      components: inventory.definitions.filter((d) => d.partUri === part && d.nativeId === null),
    }, (_, detail) => { throw new Error(detail) })
    expect(result.textListStyle.entries[0]).toMatchObject({
      level: 0, defaultRunProperties: { fontSizePt: 6.75,
        color: { kind: 'scheme', value: 'tx1', transforms: [{ kind: 'tint', value: 75000 }] } },
    })
    expect(hash()).toBe('93905a0f04c9e91376f5cbe3a7bb7a61e75e4127a6e23e0848e9cd0714b528f3')
  })

  it('admits nonempty source lists with exact declaration components and host contexts', async () => {
    const result = await project(await source())
    const definitions = result.presentation.pptxSemantic.definitions
    const list = definitions[`${master}#shape:4`].content.textListStyle
    expect(list.entries[0]).toMatchObject({
      level: 0, defaultRunProperties: {
        fontSizePt: 6.75,
        color: { kind: 'scheme', value: 'tx1', transforms: [{ kind: 'tint', value: 75000 }] },
      },
    })
    for (const componentId of [list.componentId, ...list.entries.map((e) => e.componentId)])
      expect(definitions[`${master}#shape:4`].components.some((c) => c.id === componentId)).toBe(true)
    const contexts = result.trustedSemanticImportMetadata.textStyleContexts
    const context = Object.values(contexts).find((c) => c.definitionId === `${slide}#shape:2`)
    expect(context.bindings.layoutDefinitionId).toBe(`${layout}#shape:8`)
    expect(context.paragraphs[0].run.entries.filter((e) => e.kind === 'layoutList')
      .map((e) => e.level)).toEqual([undefined, 0])
    expect(resolveProperty({
      property: 'fontSizePt', scope: 'run', layers: context.paragraphs[0].runs[0].layers,
      theme: context.theme,
    }).resolved).toBe(18)
    expect(result.presentation.pptxSemantic.fonts).toEqual({})
    expect(result.admission.visualQualification).toBe('unqualified')
  })

  it('preserves direct/default paragraph and run scopes, false and zero without flattening', async () => {
    const zip = await source()
    zip.file(slide, (await zip.file(slide).async('string'))
      .replace('<a:pPr/>', '<a:pPr lvl="0" rtl="1" marL="0"><a:defRPr b="1"/></a:pPr>')
      .replace('<a:rPr/>', '<a:rPr b="0" kern="0"><a:latin typeface="+mn-lt"/><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr>'))
    const result = await project(zip)
    const text = result.presentation.pptxSemantic.definitions[`${slide}#shape:2`].content.textDocument
    expect(text.body).toMatchObject({ insetLeftEmu: 0, anchorCenter: false })
    expect(text.paragraphs[0]).toMatchObject({
      properties: { level: 0, direction: 'rtl', marginLeftEmu: 0 },
      defaultRunProperties: { bold: true },
      runs: [{ properties: { bold: false, kerningPt: 0, fontLatin: { typeface: '+mn-lt' },
        color: { kind: 'scheme', value: 'tx1' } } }],
    })
    expect(text.paragraphs[0].runs[0].properties).not.toHaveProperty('fontSizePt')
  })
  it('retains native run typography and explicit disabling overrides through RTL contexts and JSON reopen', async () => {
    const zip = await source()
    zip.file(layout, (await zip.file(layout).async('string')).replace('<a:defRPr sz="1800" b="0">',
      '<a:defRPr sz="1800" b="0" kumimoji="1" cap="all" normalizeH="true">'))
    zip.file(slide, (await zip.file(slide).async('string')).replace('<a:rPr/>',
      '<a:rPr kumimoji="0" cap="none" normalizeH="false" smtClean="0"><a:rtl val="1"/></a:rPr>')
      .replace('</a:p>', '<a:endParaRPr kumimoji="false" cap="small" normalizeH="1"/></a:p>'))
    const result = await project(zip), presentation = JSON.parse(JSON.stringify(result.presentation))
    const text = presentation.pptxSemantic.definitions[`${slide}#shape:2`].content.textDocument
    expect(text.paragraphs[0].runs[0]).toMatchObject({ properties: {
      kumimoji: false, capitalization: 'none', normalizeHeight: false, direction: 'rtl',
    }, proofing: { smtClean: false } })
    expect(text.paragraphs[0].endRunProperties).toEqual({
      kumimoji: false, capitalization: 'small', normalizeHeight: true,
    })
    const context = Object.values(result.trustedSemanticImportMetadata.textStyleContexts)
      .find((entry) => entry.definitionId === `${slide}#shape:2`)
    for (const [property, expected] of [['kumimoji', false], ['capitalization', 'none'], ['normalizeHeight', false]])
      expect(resolveProperty({ property, scope: 'run', layers: context.paragraphs[0].runs[0].layers,
        theme: context.theme }).resolved).toBe(expected)
    expect(presentation.pptxSemantic.definitions[`${layout}#shape:8`].content.textListStyle.entries[1].defaultRunProperties)
      .toMatchObject({ kumimoji: true, capitalization: 'all', normalizeHeight: true })
  })
  it('admits text run and endParaRPr outline declarations without dropping or flattening', async () => {
    const zip = await source()
    zip.file(slide, (await zip.file(slide).async('string'))
      .replace(
        '<a:rPr/>',
        '<a:rPr><a:ln w="12700"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:rPr>'
      )
      .replace(
        '</a:p>',
        '<a:endParaRPr><a:ln><a:noFill/></a:ln></a:endParaRPr></a:p>'
      )
    )
    const result = await project(zip)
    const text = result.presentation.pptxSemantic.definitions[`${slide}#shape:2`].content.textDocument
    expect(text.paragraphs[0].runs[0].properties.outline).toEqual({
      fill: 'solid',
      color: { kind: 'scheme', value: 'bg1' },
      width: 12700,
      dash: { kind: 'preset', value: 'solid' },
    })
    expect(text.paragraphs[0].endRunProperties.outline).toEqual({
      fill: 'none',
      color: { kind: 'none' },
    })
  })


  it.each([
    ['<a:lstStyle>', '<a:lstStyle unknown="1">'],
    ['<a:defRPr sz="675">', '<a:defRPr sz="675" unknown="1">'],
    ['<a:lvl1pPr>', '<a:lvl1pPr><a:unknown/>'],
  ])('rejects unsupported list declarations instead of marking them mapped: %s', async (from, to) => {
    const zip = await source()
    zip.file(master, (await zip.file(master).async('string')).replace(from, to))
    await expect(project(zip)).rejects.toMatchObject({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: master },
    })
  })
})
