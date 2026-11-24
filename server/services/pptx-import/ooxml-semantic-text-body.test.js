import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { readSemanticTextBody } = require('./ooxml-semantic-text-body')
const { parseXml } = require('./ooxml-text-run-xml')
const fail = (source, detail) => { throw new Error(`${source.id}: ${detail}`) }
function context() {
  const xml = '<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody><a:bodyPr rtlCol="0"/></p:txBody></p:sp>'
  const node = parseXml(xml)[0], source = { id: 'shape', partUri: 'ppt/slides/slide1.xml' }
  return { xml, node, source, nodes: new Map([[source.id, node]]) }
}

describe('exact native body source association', () => {
  it('reads only the node belonging to the source definition', () => {
    const input = context()
    expect(readSemanticTextBody(input.node.children[0], input, fail)).toEqual({ rtlColumns: false })
    input.nodes.set(input.source.id, context().node)
    expect(() => readSemanticTextBody(input.node.children[0], input, fail)).toThrow(/source association/)
  })

  it('does not borrow an equal-valued sibling body', () => {
    const input = context(), sibling = context()
    expect(() => readSemanticTextBody(sibling.node.children[0], input, fail)).toThrow(/source association/)
  })

  it('rejects duplicate native text bodies', () => {
    const input = context()
    input.node.children.push(context().node.children[0])
    expect(() => readSemanticTextBody(input.node.children[0], input, fail)).toThrow(/source association/)
  })

  it('rejects a misplaced declaration even without a direct text body', () => {
    const input = context()
    input.node.children[0].local = 'spPr'
    expect(() => readSemanticTextBody(undefined, input, fail)).toThrow(/source association/)
  })

  it('admits numCol and compatLnSpc attributes on bodyPr', () => {
    const xml = '<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody><a:bodyPr numCol="2" compatLnSpc="1"/></p:txBody></p:sp>'
    const node = parseXml(xml)[0], source = { id: 'shape', partUri: 'ppt/slides/slide1.xml' }
    const input = { xml, node, source, nodes: new Map([[source.id, node]]) }
    expect(readSemanticTextBody(input.node.children[0], input, fail)).toEqual({
      columnCount: 2,
      compatibleLineSpacing: true,
    })
  })

  it('rejects out of range numCol on bodyPr', () => {
    const xml = '<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody><a:bodyPr numCol="0"/></p:txBody></p:sp>'
    const node = parseXml(xml)[0], source = { id: 'shape', partUri: 'ppt/slides/slide1.xml' }
    const input = { xml, node, source, nodes: new Map([[source.id, node]]) }
    expect(() => readSemanticTextBody(input.node.children[0], input, fail)).toThrow(/numCol range/)
  })

  it('admits textNoShape prstTxWarp beside autofit on bodyPr', () => {
    const xml = '<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody><a:bodyPr><a:prstTxWarp prst="textNoShape"><a:avLst/></a:prstTxWarp><a:spAutoFit/></a:bodyPr></p:txBody></p:sp>'
    const node = parseXml(xml)[0], source = { id: 'shape', partUri: 'ppt/slides/slide1.xml' }
    const input = { xml, node, source, nodes: new Map([[source.id, node]]) }
    expect(readSemanticTextBody(input.node.children[0], input, fail)).toEqual({
      presetTextWarp: 'textNoShape',
      autofit: { mode: 'shape' },
    })
  })

  it('rejects unsupported prstTxWarp preset on bodyPr', () => {
    const xml = '<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:txBody><a:bodyPr><a:prstTxWarp prst="textWave1"><a:avLst/></a:prstTxWarp></a:bodyPr></p:txBody></p:sp>'
    const node = parseXml(xml)[0], source = { id: 'shape', partUri: 'ppt/slides/slide1.xml' }
    const input = { xml, node, source, nodes: new Map([[source.id, node]]) }
    expect(() => readSemanticTextBody(input.node.children[0], input, fail)).toThrow(/unsupported warp preset/)
  })
})
