import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { fixture, slide, layout, master, shape } from './semantic-text-style-context-fixture'

const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { resolveProperty } = require('../../shared/src/pptx-style-resolution')
// Dynamic loading collects behavioral tests before the implementation exists.
const api = () => require('../../server/services/pptx-import/ooxml-semantic-text-context')
async function input(zip, definitionId = `${slide}#shape:2`) {
  const inventory = await buildSemanticInventory(zip)
  const occurrenceId = inventory.occurrences.find((o) => o.definitionId === definitionId).id
  return { zip, inventory, occurrenceId }
}
const resolve = (context, property, scope = 'run') =>
  resolveProperty({
    property,
    scope,
    layers: context.paragraphs[0][scope],
    theme: context.theme,
  })
describe('source-bound text style contexts', () => {
  it('follows actual relationships and placeholder idx then type, preserving separate scopes', async () => {
    const request = await input(await fixture())
    const before = JSON.stringify(request.inventory)
    const context = await api().readSemanticTextStyleContext(request)
    expect(context.relationships.map((r) => r.relationshipId)).toEqual([
      'actualSlide',
      'actualLayout',
      'actualMaster',
      'actualTheme',
    ])
    expect(context.bindings.layoutDefinitionId).toBe(`${layout}#shape:8`)
    expect(context.bindings.masterDefinitionId).toBe(`${master}#shape:4`)
    expect(resolve(context, 'fontSizePt').resolved).toBe(18)
    expect(resolve(context, 'fontLatin').authored).toEqual({ typeface: '+mn-lt' })
    expect(resolve(context, 'fontLatin').resolved).toBe('Minor')
    expect(resolve(context, 'bold').resolved).toBe(false)
    expect(resolve(context, 'italic').resolved).toBe(false)
    expect(resolve(context, 'marginLeftEmu', 'paragraph').resolved).toBe(0)
    expect(resolve(context, 'direction', 'paragraph').resolved).toBe('ltr')
    expect(resolve(context, 'direction').resolved).toBe(null)
    expect(context.paragraphs[0].run.target).not.toHaveProperty('level')
    expect(context.body.entries[0].properties).toMatchObject({
      insetLeftEmu: 0,
      anchorCenter: false,
    })
    expect(context.fontRequests).toContainEqual(expect.objectContaining({ typeface: '+mn-lt' }))
    expect(context.fontRequests.every((r) => r.typeface.length > 0)).toBe(true)
    expect(JSON.parse(JSON.stringify(context))).toEqual(context)
    expect(JSON.stringify(request.inventory)).toBe(before)
  })
  it('preserves default versus explicit level zero and direct paragraph/run overrides', async () => {
    const zip = await fixture()
    let xml = await zip.file(slide).async('string')
    xml = xml
      .replace('<a:pPr/>', '<a:pPr lvl="0" rtl="1"><a:defRPr b="1"/></a:pPr>')
      .replace('<a:rPr/>', '<a:rPr b="0" kern="0"/>')
    zip.file(slide, xml)
    const context = await api().readSemanticTextStyleContext(await input(zip))
    const entries = context.paragraphs[0].run.entries.filter((e) => e.kind === 'layoutList')
    expect(entries.map((e) => e.level)).toEqual([undefined, 0])
    expect(resolve(context, 'bold').resolved).toBe(true)
    expect(
      resolveProperty({
        property: 'bold',
        scope: 'run',
        layers: context.paragraphs[0].runs[0].layers,
        theme: context.theme,
      }).resolved
    ).toBe(false)
    expect(context.paragraphs[0].paragraph.target.level).toBe(0)
  })
  it('uses presentation defaults for non-placeholder text without guessed defaults', async () => {
    const zip = await fixture()
    zip.file(
      slide,
      (await zip.file(slide).async('string')).replace('<p:ph type="obj" idx="7"/>', '')
    )
    const context = await api().readSemanticTextStyleContext(await input(zip))
    expect(resolve(context, 'fontSizePt').resolved).toBe(11)
    expect(resolve(context, 'bold').resolved).toBe(false)
    expect(context.bindings.layoutDefinitionId).toBe(null)
  })
  it('deduplicates inherited master body multi-level paragraphs without ambiguous-style-source collisions', async () => {
    const zip = await fixture()
    const masterXml = (await zip.file(master).async('string')).replace(
      '<a:p><a:pPr/><a:r><a:rPr/><a:t>Text</a:t></a:r></a:p>',
      '<a:p><a:pPr lvl="0"/><a:r><a:rPr sz="2400" b="1"/><a:t>Level 0</a:t></a:r></a:p>' +
      '<a:p><a:pPr lvl="1"/><a:r><a:rPr sz="2000" b="0"/><a:t>Level 1</a:t></a:r></a:p>' +
      '<a:p><a:pPr lvl="2"/><a:r><a:rPr sz="1600"/><a:t>Level 2</a:t></a:r></a:p>' +
      '<a:p><a:pPr lvl="3"/><a:r><a:rPr sz="1400"/><a:t>Level 3</a:t></a:r></a:p>' +
      '<a:p><a:pPr lvl="4"/><a:r><a:rPr sz="1200"/><a:t>Level 4</a:t></a:r></a:p>'
    )
    zip.file(master, masterXml)
    const context = await api().readSemanticTextStyleContext(await input(zip))
    const res = resolve(context, 'fontSizePt')
    expect(res.unsupportedReason).not.toBe('ambiguous-style-source')
    expect(res.resolved).toBe(18)
  })
  it.each([
    'ambiguous-placeholder',
    'stale-part',
    'stale-relationship',
    'external',
    'override',
    'unsupported-style',
    'forged-occurrence',
  ])('rejects %s with a numeric source location', async (kind) => {
    const zip = await fixture()
    if (kind === 'ambiguous-placeholder')
      zip.file(
        layout,
        (await zip.file(layout).async('string')).replace(
          '</p:spTree>',
          `${shape(9, 'body', 7)}</p:spTree>`
        )
      )
    if (kind === 'external')
      zip.file(
        'ppt/slides/_rels/slide9.xml.rels',
        (await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string')).replace(
          'Target=',
          'TargetMode="External" Target='
        )
      )
    if (kind === 'override')
      zip.file(
        'ppt/slideLayouts/_rels/unrelated-name.xml.rels',
        (await zip.file('ppt/slideLayouts/_rels/unrelated-name.xml.rels').async('string')).replace(
          '/slideMaster"',
          '/themeOverride"'
        )
      )
    if (kind === 'unsupported-style')
      zip.file(
        master,
        (await zip.file(master).async('string')).replace(
          '<a:defRPr i="0"/>',
          '<a:defRPr i="0" unknown="1"/>'
        )
      )
    const request = await input(zip)
    if (kind === 'stale-part') zip.file(master, (await zip.file(master).async('string')) + ' ')
    if (kind === 'stale-relationship')
      zip.file(
        'ppt/slides/_rels/slide9.xml.rels',
        (await zip.file('ppt/slides/_rels/slide9.xml.rels').async('string')) + ' '
      )
    if (kind === 'forged-occurrence')
      request.inventory.occurrences.find(
        (o) => o.id === request.occurrenceId
      ).relationshipChain[1] = 'guess'
    let error
    try {
      await api().readSemanticTextStyleContext(request)
    } catch (caught) {
      error = caught
    }
    expect(error?.code).toBe('PPTX_SEMANTIC_ADMISSION_FAILED')
    expect(error.sourceLocation.path.every(Number.isSafeInteger)).toBe(true)
    expect(error.sourceLocation.partUri).toBeTruthy()
  })
  it('reaches the sealed actual master shape4 declaration per host occurrence', async () => {
    const path =
      '.omo/evidence/pptx-semantic/resume-path-gradient-domain-focus-reference/path-gradient-reference.pptx'
    const bytes = await readFile(path)
    const sha = (value) => createHash('sha256').update(value).digest('hex')
    expect(sha(bytes)).toBe('93905a0f04c9e91376f5cbe3a7bb7a61e75e4127a6e23e0848e9cd0714b528f3')
    const request = await input(
      await JSZip.loadAsync(bytes),
      'ppt/slideMasters/slideMaster1.xml#shape:4'
    )
    const context = await api().readSemanticTextStyleContext(request)
    const layer = context.paragraphs[0].run.entries.find(
      (e) => e.kind === 'shapeList' && e.level === 0
    )
    expect(layer.properties).toMatchObject({
      fontSizePt: 6.75,
      color: { kind: 'scheme', value: 'tx1', transforms: [{ kind: 'tint', value: 75000 }] },
    })
    expect(layer.source).toEqual({
      part: 'ppt/slideMasters/slideMaster1.xml',
      path: '0.0.1.4.2.1.0',
    })
    expect(context.relationships.map((r) => r.targetPartUri)).toContain(
      'ppt/slideLayouts/slideLayout7.xml'
    )
    expect(context.relationships.map((r) => r.targetPartUri)).toContain(
      'ppt/slideMasters/slideMaster1.xml'
    )
    expect(sha(await readFile(path))).toBe(sha(bytes))
  })
})
