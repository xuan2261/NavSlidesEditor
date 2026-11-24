import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { tableSource } = require('../../server/services/pptx-import/ooxml-semantic-table-source')
const { listParagraphProperties } = require('../../server/services/pptx-import/ooxml-semantic-text-list-style-properties')
const { runProperties } = require('../../server/services/pptx-import/ooxml-semantic-table-text-properties')
const { normalizeTextProperties } = require('../../shared/src/pptx-text-document')
const partUri = 'ppt/slideMasters/slideMaster1.xml'
const native = 'typeface="Arial" panose="020B0604020202020204" pitchFamily="34" charset="0"'
const descriptor = { typeface: 'Arial', panose: '020B0604020202020204', pitchFamily: 34, charset: 0 }
function read(attributes = native, host = 'bullet') {
  const inner = host === 'bullet' ? `<a:buClrTx/><a:buSzTx/><a:buFont ${attributes}/>` :
    `<a:latin ${attributes}/>${host === 'rtl' ? '<a:rtl val="1"/>' : ''}`
  const xml = `<a:${host === 'bullet' ? 'pPr' : 'rPr'} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${inner}</a:${host === 'bullet' ? 'pPr' : 'rPr'}>`
  const node = parseXml(xml)[0], hash = createHash('sha256').update(xml).digest('hex')
  const source = { id: 'owner', partUri, preconditionHash: hash,
    componentLocators: [{ path: [0, 3, 1, 0], preconditionHash: hash }] }
  const boundary = tableSource({ source, node, xml, components: [], nodes: new Map([['owner', node]]) })
  return host === 'bullet' ? listParagraphProperties(node, boundary).properties : runProperties(node, boundary).properties
}

describe('exact native bullet and run font descriptor constituents', () => {
  it.each(['bullet', 'run', 'rtl'])('retains the same authored descriptor on %s without source defaults', (host) => {
    const properties = read(native, host), key = host === 'bullet' ? 'bulletFont' : 'fontLatin'
    expect(properties[key]).toEqual(descriptor)
    expect(normalizeTextProperties(JSON.parse(JSON.stringify(properties)), host === 'bullet' ? 'paragraph' : 'run'))
      .toEqual(properties)
    expect(read('typeface="Arial"', host)[key]).toEqual({ typeface: 'Arial' })
  })

  it('retains hex byte spelling while accepting the ST_Panose hexBinary whitespace domain', () => {
    expect(read(native.replace('020B0604020202020204', ' 020b0604020202020204 ')).bulletFont.panose)
      .toBe('020b0604020202020204')
  })

  it.each([
    'panose="020B"', 'panose="020B060402020202020400"', 'panose="020G0604020202020204"',
    'panose="020B0604020202020204" panose="020B0604020202020204"',
    'a:panose="020B0604020202020204"', 'charset="128"', 'pitchFamily="-129"', 'pitchFamily="3"', 'unknown="0"',
  ])('rejects malformed, duplicate, namespaced and unknown descriptors at the native buFont: %s', (attrs) => {
    expect(() => read(`typeface="Arial" ${attrs}`)).toThrow()
    try { read(`typeface="Arial" ${attrs}`) } catch (error) {
      expect(error).toMatchObject({
        code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        sourceLocation: { partUri, localName: 'buFont', path: [0, 3, 1, 0, 2] },
      })
    }
  })

  it.each(['020B', '020G0604020202020204', '020B0604020202020204\n', 2020202020, null])('rejects malformed canonical PANOSE: %j', (panose) => {
    for (const [scope, key] of [['run', 'fontLatin'], ['paragraph', 'bulletFont']])
      expect(() => normalizeTextProperties({ [key]: { typeface: 'Arial', panose } }, scope)).toThrow()
  })

  it.each([0, 1, 2, 16, 17, 18, 32, 33, 34, 48, 49, 50, 64, 65, 66, 80, 81, 82])(
    'retains every ST_PitchFamily value: %i', (pitchFamily) => {
      expect(read(`typeface="Arial" pitchFamily="${pitchFamily}"`).bulletFont).toEqual({ typeface: 'Arial', pitchFamily })
    }
  )
})
