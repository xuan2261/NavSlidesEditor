import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'

const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticEquation } = require('../../server/services/pptx-import/ooxml-semantic-equation')
const { normalizeOmmlDocument } = require('../../shared/src/pptx-omml-document')
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const run = (text) => `<m:r><m:t>${text}</m:t></m:r>`
const payload = `<m:oMathPara><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr><m:oMath>
  <m:f><m:fPr><m:type m:val="skw"/></m:fPr><m:num>${run('x')}</m:num>
  <m:den><m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${run('2')}</m:e></m:rad></m:den></m:f>
  <m:sSubSup><m:e>${run('a')}</m:e><m:sub>${run('i')}</m:sub><m:sup>${run('n')}</m:sup></m:sSubSup>
  <m:nary><m:naryPr><m:chr m:val="&#x2211;"/><m:limLoc m:val="undOvr"/></m:naryPr><m:sub>${run('0')}</m:sub><m:sup>${run('n')}</m:sup><m:e>${run('x')}</m:e></m:nary>
  <m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr><m:e><m:m><m:mr><m:e>${run('1')}</m:e><m:e>${run('2')}</m:e></m:mr><m:mr><m:e>${run('3')}</m:e><m:e>${run('4')}</m:e></m:mr></m:m></m:e></m:d>
  <m:acc><m:accPr><m:chr m:val="&#x302;"/></m:accPr><m:e>${run('y')}</m:e></m:acc>
  <m:eqArr><m:e>${run('a=b')}</m:e><m:e>${run('b=c')}</m:e></m:eqArr>
  <m:r><m:rPr><m:sty m:val="bi"/><m:scr m:val="double-struck"/><m:nor/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math"/><w:b/><w:color w:val="123ABC"/><w:sz w:val="24"/></w:rPr><m:t xml:space="preserve"> x &amp; y </m:t></m:r>
</m:oMath></m:oMathPara>`

async function context(body = payload) {
  const partUri = 'ppt/slides/slide1.xml'
  const xml = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:m="${M}" xmlns:w="${W}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="7"/></p:nvSpPr>${body}</p:sp></p:spTree></p:cSld></p:sld>`
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>')
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>')
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>')
  zip.file(partUri, xml)
  const inventory = await buildSemanticInventory(zip)
  const source = inventory.definitions.find((entry) => ['oMathPara', 'oMath'].includes(entry.localName))
  const roots = parseXml(xml), nodes = new Map()
  for (const entry of inventory.definitions.filter((item) => item.partUri === partUri)) {
    let node = { children: roots }
    for (const index of entry.componentLocators[0].path) node = node.children[index]
    nodes.set(entry.id, node)
  }
  const path = source.componentLocators[0].path
  const components = inventory.definitions.filter((item) => item.id !== source.id && item.partUri === partUri &&
    path.every((index, i) => item.componentLocators[0].path[i] === index))
  return { source, node: nodes.get(source.id), components, nodes, xml }
}
const flatten = (node) => [node, ...node.children.flatMap(flatten)]

describe('located native OMML source reader', () => {
  it('reads real namespace XML and maps every inventory constituent exactly once in authored order', async () => {
    const input = await context(), result = readSemanticEquation(input)
    expect(result.mappedDefinitionIds).toEqual([input.source.id, ...input.components.map((item) => item.id)])
    const all = flatten(result.ommlDocument.root)
    expect(result.components).toHaveLength(all.length)
    expect(new Set(all.map((node) => node.componentId)).size).toBe(all.length)
    expect(all.filter((node) => node.type === 't').at(-1).text).toBe(' x & y ')
    expect(all.find((node) => node.type === 'chr').attributes[0].value).toBe('\u2211')
    expect(all.map((node) => node.type)).toEqual(expect.arrayContaining(['f', 'rad', 'sSubSup', 'nary', 'm', 'd', 'acc', 'eqArr', 'rPr', 'rFonts']))
    for (const binding of result.components) {
      let node = { children: parseXml(input.xml) }
      for (const index of binding.locator.path) node = node.children[index]
      expect(all.find((entry) => entry.componentId === binding.id).type).toBe(node.local)
      expect(binding.locator.preconditionHash).toBe(createHash('sha256').update(input.xml).digest('hex'))
    }
    expect(normalizeOmmlDocument(JSON.parse(JSON.stringify(result.ommlDocument)))).toEqual(result.ommlDocument)
    expect(readSemanticEquation(input)).toEqual(result)
  })

  it.each([
    '<m:oMath><m:f><m:den/><m:num/></m:f></m:oMath>',
    '<m:oMath><m:f><m:num/></m:f></m:oMath>',
    '<m:oMath><m:r><m:t>x</m:t><m:t>y</m:t></m:r></m:oMath>',
    '<m:oMath><m:future/></m:oMath>',
    '<m:oMath><m:r m:unknown="x"><m:t>x</m:t></m:r></m:oMath>',
    '<m:oMath><m:r><m:t xmlns:m="urn:foreign">x</m:t></m:r></m:oMath>',
    '<m:oMath><m:r><m:t m:space="preserve">x</m:t></m:r></m:oMath>',
    '<m:oMath>lost<m:r><m:t>x</m:t></m:r></m:oMath>',
    '<m:oMath><m:r><m:rPr><m:sty m:val="future"/></m:rPr><m:t>x</m:t></m:r></m:oMath>',
    '<m:oMath><m:r><m:rPr><m:sty/></m:rPr><m:t>x</m:t></m:r></m:oMath>',
    '<m:oMath><m:r><m:rPr><m:sty m:val="b" m:val="i"/></m:rPr><m:t>x</m:t></m:r></m:oMath>',
    '<m:oMath><m:r><m:rPr><m:sty val="b"/></m:rPr><m:t>x</m:t></m:r></m:oMath>',
  ])('fails atomically with a source location for unsupported or malformed XML', async (body) => {
    const input = await context(body), before = JSON.stringify(input.components)
    expect(() => readSemanticEquation(input)).toThrow(expect.objectContaining({
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: expect.objectContaining({
        partUri: input.source.partUri, path: expect.any(Array), localName: expect.any(String),
      }),
    }))
    expect(JSON.stringify(input.components)).toBe(before)
  })

  it.each(['hash', 'owner', 'locator', 'duplicate', 'missing', 'root'])('rejects %s identity mismatch', async (kind) => {
    const input = await context()
    if (kind === 'hash') input.xml += ' '
    if (kind === 'owner') input.components[0] = { ...input.components[0], parentDefinitionId: 'wrong' }
    if (kind === 'locator') input.components[0] = { ...input.components[0], componentLocators: [{ path: [99], preconditionHash: input.source.preconditionHash }] }
    if (kind === 'duplicate') input.components.push(input.components[0])
    if (kind === 'missing') input.components.shift()
    if (kind === 'root') input.source = { ...input.source, kind: 'shape' }
    expect(() => readSemanticEquation(input)).toThrow(expect.objectContaining({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED' }))
  })

  it('uses namespace identities for aliased math and attribute prefixes', async () => {
    const input = await context('<m:oMath><m:r xmlns:q="' + M + '"><q:rPr><q:sty q:val="b"/></q:rPr><q:t>x</q:t></m:r></m:oMath>')
    const all = flatten(readSemanticEquation(input).ommlDocument.root)
    expect(all.find((node) => node.type === 'sty').attributes).toEqual([{ namespaceUri: M, name: 'val', value: 'b' }])
  })

  it('preserves DrawingML run fonts, native units, color and operator control properties', async () => {
    const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const input = await context(`<m:oMath xmlns:a="${a}"><m:bar><m:barPr><m:pos m:val="top"/><m:ctrlPr><a:rPr sz="1800" b="1"><a:solidFill><a:srgbClr val="123ABC"/></a:solidFill><a:latin typeface="Cambria Math"/></a:rPr></m:ctrlPr></m:barPr><m:e><m:r><a:rPr baseline="25000" i="1"/><m:t>x</m:t></m:r></m:e></m:bar></m:oMath>`)
    const all = flatten(readSemanticEquation(input).ommlDocument.root)
    expect(all.filter((node) => node.type === 'rPr').map((node) => node.attributes)).toEqual([
      [{ namespaceUri: '', name: 'sz', value: '1800' }, { namespaceUri: '', name: 'b', value: '1' }],
      [{ namespaceUri: '', name: 'baseline', value: '25000' }, { namespaceUri: '', name: 'i', value: '1' }],
    ])
    expect(all.find((node) => node.type === 'latin').attributes[0].value).toBe('Cambria Math')
  })

  it('retains ordered native DrawingML color transforms and source identities through reload', async () => {
    const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const input = await context(`<m:oMath xmlns:a="${a}"><m:r><a:rPr><a:solidFill><a:srgbClr val="1C5E29"><a:lumMod val="50000"/><a:alpha val="50000"/><a:alphaMod val="50000"/></a:srgbClr></a:solidFill></a:rPr><m:t>x</m:t></m:r></m:oMath>`)
    const result = readSemanticEquation(input)
    const color = flatten(result.ommlDocument.root).find(node => node.type === 'srgbClr')
    expect(color.children.map(node => [node.type, node.attributes[0].value])).toEqual([
      ['lumMod', '50000'], ['alpha', '50000'], ['alphaMod', '50000'],
    ])
    for (const child of color.children) expect(result.components.find(component => component.id === child.componentId))
      .toMatchObject({ locator: { preconditionHash: input.source.preconditionHash } })
    expect(normalizeOmmlDocument(JSON.parse(JSON.stringify(result.ommlDocument)))).toEqual(result.ommlDocument)
  })

  it.each(['<a:lumMod/>', '<a:lumMod val="0.5"/>', '<a:alpha val="100001"/>',
    '<a:tint val="-1"/>', '<a:lumOff val="2147483648"/>', '<a:unknown val="50000"/>',
    '<a:lumMod val="50000"><a:alpha val="50000"/></a:lumMod>'])('rejects malformed or unsupported OMML color transforms at their original source', async transform => {
    const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const input = await context(`<m:oMath xmlns:a="${a}"><m:r><a:rPr><a:solidFill><a:srgbClr val="1C5E29">${transform}</a:srgbClr></a:solidFill></a:rPr><m:t>x</m:t></m:r></m:oMath>`)
    expect(() => readSemanticEquation(input)).toThrow(expect.objectContaining({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: expect.objectContaining({ partUri: input.source.partUri, path: expect.any(Array) }) }))
  })

  it.each([['dirty', '0'], ['err', 'true'], ['smtClean', '1']])('retains nonvisual DrawingML proofing flag %s=%s', async (name, value) => {
    const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const input = await context(`<m:oMath xmlns:a="${a}"><m:r><a:rPr ${name}="${value}"/><m:t>x</m:t></m:r></m:oMath>`)
    const result = readSemanticEquation(input)
    expect(flatten(result.ommlDocument.root).find(node => node.type === 'rPr').attributes)
      .toEqual([{ namespaceUri: '', name, value }])
    expect(normalizeOmmlDocument(JSON.parse(JSON.stringify(result.ommlDocument)))).toEqual(result.ommlDocument)
  })

  it.each(['dirty="2"', 'dirty="maybe"', 'smtClean=""', 'err="-1"', 'a:dirty="0"'])('rejects invalid proofing metadata %s', async attributes => {
    const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const input = await context(`<m:oMath xmlns:a="${a}"><m:r><a:rPr ${attributes}/><m:t>x</m:t></m:r></m:oMath>`)
    expect(() => readSemanticEquation(input)).toThrow(expect.objectContaining({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      sourceLocation: expect.objectContaining({ partUri: input.source.partUri, localName: 'rPr' }) }))
  })
})
