import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'

const require = createRequire(import.meta.url)
const { readSemanticTextListStyle } = require('./ooxml-semantic-text-list-style')
const { parseXml } = require('./ooxml-text-run-xml')
const { buildSemanticInventory } = require('./semantic-inventory')
const { resolveProperty } = require('../../../shared/src/pptx-style-resolution')
const file = '.omo/evidence/pptx-semantic/resume-path-gradient-domain-focus-reference/path-gradient-reference.pptx'
const expectedHash = '93905a0f04c9e91376f5cbe3a7bb7a61e75e4127a6e23e0848e9cd0714b528f3'
const part = 'ppt/slideMasters/slideMaster1.xml'
const hash = (v) => createHash('sha256').update(v).digest('hex')
let bytes
beforeAll(async () => { bytes = await readFile(file); expect(hash(bytes)).toBe(expectedHash) })

async function context(style, strict = false) {
  const zip = await JSZip.loadAsync(bytes)
  let xml = await zip.file(part).async('string')
  if (style !== undefined) {
    const roots = parseXml(xml), find = (node) => node.local === 'sp' &&
      node.children.some((c) => c.local === 'nvSpPr' &&
        c.children.some((n) => n.local === 'cNvPr' && n.attrs.some((a) => a.name === 'id' && a.value === '4')))
    const walk = (node) => find(node) ? node : node.children.map(walk).find(Boolean)
    const owner = roots.map(walk).find(Boolean)
    const list = owner.children.find((n) => n.local === 'txBody').children.find((n) => n.local === 'lstStyle')
    xml = xml.slice(0, list.start) + style + xml.slice(list.closeEnd + 1)
    zip.file(part, xml)
  }
  if (strict) {
    xml = xml.replaceAll('http://schemas.openxmlformats.org/drawingml/2006/main',
      'http://purl.oclc.org/ooxml/drawingml/main')
      .replaceAll('http://schemas.openxmlformats.org/presentationml/2006/main',
        'http://purl.oclc.org/ooxml/presentationml/main')
    zip.file(part, xml)
  }
  const inventory = await buildSemanticInventory(zip), roots = parseXml(xml), nodes = new Map()
  const definitions = inventory.definitions.filter((d) => d.partUri === part)
  for (const d of definitions) {
    let node = { children: roots }
    for (const i of d.componentLocators[0].path) node = node.children[i]
    nodes.set(d.id, node)
  }
  const source = definitions.find((d) => d.kind === 'shape' && d.nativeId === '4')
  return { source, node: nodes.get(source.id), xml, nodes,
    components: definitions.filter((d) => {
      let parent = definitions.find((p) => p.id === d.parentDefinitionId)
      while (parent && parent.nativeId === null) parent = definitions.find((p) => p.id === parent.parentDefinitionId)
      return parent?.id === source.id
    }) }
}
const list = (body) => `<a:lstStyle>${body}</a:lstStyle>`

describe('strict list style source provider', () => {
  it('extracts the actual sealed master shape4 declaration without changing source', async () => {
    const input = await context(), before = JSON.stringify(input.source), xmlBefore = input.xml
    const result = readSemanticTextListStyle(input)
    expect(result.listStyle.entries.length).toBeGreaterThan(0)
    expect(result.components.length).toBeGreaterThan(1)
    expect(result.listStyle.entries[0]).toMatchObject({ level: 0, properties: { alignment: 'l' },
      defaultRunProperties: { fontSizePt: 6.75,
        color: { kind: 'scheme', value: 'tx1', transforms: [{ kind: 'tint', value: 75000 }] } },
      source: { part, path: '0.0.1.4.2.1.0' } })
    expect(result.components.every((b) => b.locator.preconditionHash === input.source.preconditionHash)).toBe(true)
    expect(new Set(result.components.map((b) => b.id)).size).toBe(result.components.length)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    expect(JSON.stringify(input.source)).toBe(before)
    expect(input.xml).toBe(xmlBefore)
    expect(hash(await readFile(file))).toBe(expectedHash)
    expect(hash(bytes)).toBe(expectedHash)
  })

  it('keeps source order, explicit defaults and all represented paragraph/run declarations', async () => {
    const input = await context(list('<a:defPPr rtl="0"><a:tabLst/></a:defPPr>' +
      '<a:lvl1pPr lvl="0" marL="0"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc>' +
      '<a:buClr><a:schemeClr val="accent1"><a:tint val="20000"/></a:schemeClr></a:buClr>' +
      '<a:buSzPct val="90000"/><a:buFont typeface="+mn-lt"/><a:buChar char="&#8226;"/>' +
      '<a:defRPr sz="1200" b="0"><a:latin typeface="+mn-lt" pitchFamily="0"/>' +
      '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr>' +
      '<a:lvl9pPr><a:buNone/></a:lvl9pPr>'))
    const result = readSemanticTextListStyle(input), entries = result.listStyle.entries
    expect(entries.map((e) => e.level)).toEqual([undefined, 0, 8])
    expect(entries[0].properties).toEqual({ direction: 'ltr', tabs: [] })
    expect(entries[1].properties.bulletColor).toEqual({ kind: 'scheme', value: 'accent1',
      transforms: [{ kind: 'tint', value: 20000 }] })
    expect(entries[1].defaultRunProperties.fontLatin).toEqual({ typeface: '+mn-lt', pitchFamily: 0 })
    const layers = { target: { level: 0 }, entries: entries.map((e) => ({
      id: e.componentId, source: e.source, kind: 'shapeList',
      ...(e.level !== undefined ? { level: e.level } : {}),
      properties: e.defaultRunProperties || {},
    })) }
    expect(resolveProperty({ property: 'fontSizePt', scope: 'run', layers }).resolved).toBe(12)
  })

  it.each([false, true])('reads alias prefixes and all nine levels in strict namespace=%s', async (strict) => {
    const input = await context('<z:lstStyle xmlns:z="' + (strict ?
      'http://purl.oclc.org/ooxml/drawingml/main' : 'http://schemas.openxmlformats.org/drawingml/2006/main') +
      '"><z:defPPr lvl="0"/>' + Array.from({ length: 9 }, (_, i) => `<z:lvl${i + 1}pPr/>`).join('') +
      '</z:lstStyle>', strict)
    const entries = readSemanticTextListStyle(input).listStyle.entries
    expect(entries.map((e) => e.level)).toEqual([undefined, 0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(entries[0].properties).toEqual({ level: 0 })
  })

  it('preserves text-relative bullets, numeric bullets, spacing, tabs and RTL runs', async () => {
    const input = await context(list('<a:defPPr><a:buClrTx/><a:buSzTx/><a:buFontTx/></a:defPPr>' +
      '<a:lvl2pPr algn="r" indent="-100" defTabSz="0" fontAlgn="base" hangingPunct="0" latinLnBrk="1" eaLnBrk="0">' +
      '<a:spcBef><a:spcPts val="125"/></a:spcBef><a:spcAft><a:spcPct val="50000"/></a:spcAft>' +
      '<a:tabLst><a:tab pos="100" algn="dec"/><a:tab pos="-1"/></a:tabLst>' +
      '<a:buSzPts val="1200"/><a:buAutoNum type="arabicPeriod" startAt="3"/>' +
      '<a:defRPr sz="2400" i="false" kern="100" baseline="-2000" spc="50">' +
      '<a:latin typeface="Arial"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/>' +
      '<a:solidFill><a:srgbClr val="AABBCC"/></a:solidFill><a:rtl val="1"/></a:defRPr></a:lvl2pPr>'))
    const entries = readSemanticTextListStyle(input).listStyle.entries
    expect(entries[0].properties).toEqual({ bulletColor: 'text', bulletSize: 'text', bulletFont: 'text' })
    expect(entries[1].properties).toMatchObject({ bullet: { kind: 'number', scheme: 'arabicPeriod', startAt: 3 },
      bulletSize: { unit: 'points', value: 12 }, spaceBefore: { unit: 'points', value: 1.25 },
      tabs: [{ positionEmu: 100, alignment: 'dec' }, { positionEmu: -1 }] })
    expect(entries[1].defaultRunProperties).toMatchObject({ direction: 'rtl', fontSizePt: 24, italic: false,
      kerningPt: 1, spacingPt: 0.5, baseline: -2000, color: { kind: 'srgb', value: 'AABBCC' } })
  })

  it.each([
    '<a:lvl1pPr/><a:lvl1pPr/>', '<a:lvl1pPr wat="1"/>',
    '<a:lvl1pPr lvl="9"/>', '<a:lvl1pPr lvl="bad"/>',
    '<a:lvl1pPr><a:buNone/><a:buChar char="x"/></a:lvl1pPr>',
    '<a:lvl1pPr><a:buSzTx/><a:buSzPts val="100"/></a:lvl1pPr>',
    '<a:lvl1pPr><a:defRPr smtClean="1"/></a:lvl1pPr>',
    '<a:lvl1pPr><a:defRPr><a:latin typeface="x" pitchFamily="3"/></a:defRPr></a:lvl1pPr>',
    '<a:lvl1pPr><a:extLst/></a:lvl1pPr>', '<a:lvl1pPr>bad</a:lvl1pPr>',
    '<x:lvl1pPr xmlns:x="urn:wrong"/>', '<a:lvl1pPr><a:tabLst><a:tab/></a:tabLst></a:lvl1pPr>',
    '<a:lvl1pPr><a:buClr/></a:lvl1pPr>', '<a:lvl1pPr><a:buSzPct val="-1"/></a:lvl1pPr>',
    '<a:lvl1pPr lvl="0" lvl="1"/>', '<a:lvl1pPr><a:defRPr><a:rtl val="2"/></a:defRPr></a:lvl1pPr>',
    '<a:lvl1pPr><a:buClr><a:schemeClr val="tx1"><a:gamma/></a:schemeClr></a:buClr></a:lvl1pPr>',
  ])('rejects unsupported or malformed source with a numeric locator %#', async (body) => {
    const input = await context(list(body)), before = input.xml
    let error
    try { readSemanticTextListStyle(input) } catch (caught) { error = caught }
    expect(error?.code).toBe('PPTX_SEMANTIC_ADMISSION_FAILED')
    expect(error.sourceLocation.partUri).toBe(part)
    expect(error.sourceLocation.path.every(Number.isSafeInteger)).toBe(true)
    expect(input.xml).toBe(before)
  })

  it.each(['hash', 'owner', 'namespace', 'locator', 'node', 'nativeId', 'id'])('rejects stale or wrong-owner context %s', async (mode) => {
    const input = await context()
    if (mode === 'hash') input.source.preconditionHash = '0'.repeat(64)
    if (mode === 'owner') input.source.kind = 'picture'
    if (mode === 'namespace') input.source.namespaceUri = 'urn:wrong'
    if (mode === 'locator') input.source.componentLocators[0].path = [0]
    if (mode === 'node') input.nodes.set(input.source.id, {})
    if (mode === 'nativeId') input.source.nativeId = '99'
    if (mode === 'id') {
      input.source.id = `${part}#shape:99`
      input.nodes.set(input.source.id, input.node)
    }
    expect(() => readSemanticTextListStyle(input)).toThrow()
  })

  it('revalidates caller-owned descendants after a successful standalone read', async () => {
    const input = await context(list('<a:lvl1pPr marL="0"><a:defRPr b="0"/></a:lvl1pPr>'))
    expect(readSemanticTextListStyle(input).listStyle.entries[0].defaultRunProperties.bold).toBe(false)
    const body = input.node.children.find((n) => n.local === 'txBody')
    const declaration = body.children.find((n) => n.local === 'lstStyle').children[0]
    declaration.children[0].attrs.find((a) => a.name === 'b').value = '1'
    expect(() => readSemanticTextListStyle(input)).toThrow(/source locator or XML association/)
  })

  it('distinguishes absent from an explicit empty list', async () => {
    const empty = await context('<a:lstStyle/>')
    expect(readSemanticTextListStyle(empty).listStyle.entries).toEqual([])
    const absent = await context('')
    expect(readSemanticTextListStyle(absent)).toBeUndefined()
  })
})
