import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, partUri } from './smartart-layout-fixture.js'
const require = createRequire(import.meta.url)
const { evaluateSmartArtLayout } = require('../../shared/src/pptx-smartart-layout')
const { normalizeSmartArtDocument } = require('../../shared/src/pptx-smartart-document')

function sourceChoose(xml, change = (x) => x) {
  return xml.replace(/<d:forEach[\s\S]*?<\/d:forEach>/, (body) =>
    change(`<d:choose name="selection">
      <d:if name="first" func="cnt" op="equ" val="1">${body.replace('styleLbl="node1"', 'styleLbl="first"')}</d:if>
      <d:if name="second" func="cnt" op="lte" val="2">${body.replace('styleLbl="node1"', 'styleLbl="second"')}</d:if>
      <d:else name="fallback">${body.replace('styleLbl="node1"', 'styleLbl="fallback"')}</d:else>
    </d:choose>`)
  )
}
const admission = (change) => fixture({ change: (xml) => sourceChoose(xml, change) })
const bounds = { x: 0, y: 0, width: 200, height: 100 }
const diagramUris = [
  'http://schemas.openxmlformats.org/drawingml/2006/diagram',
  'http://purl.oclc.org/ooxml/drawingml/diagram',
]

describe('source XML SmartArt choose admission', () => {
  it.each(diagramUris)('admits ordered repeated if branches in %s', async (uri) => {
    const { document, inventory, source } = await fixture({
      change: (xml) => sourceChoose(xml).replace(diagramUris[0], uri),
    })
    const declarations = document.layout.declarations
    const choose = declarations.find((d) => d.type === 'choose')
    const branches = choose.children.map((id) => declarations.find((d) => d.componentId === id))
    expect(branches.map((d) => [d.type, d.attributes.name])).toEqual([
      ['if', 'first'], ['if', 'second'], ['else', 'fallback'],
    ])
    expect(choose.source).toEqual({
      partUri, preconditionHash: document.layout.source.preconditionHash, path: [0, 0, 2],
    })
    expect(branches.map((d) => d.source.path)).toEqual([
      [0, 0, 2, 0], [0, 0, 2, 1], [0, 0, 2, 2],
    ])
    expect(declarations.map((d) => d.source.path.join('.'))).toEqual(
      [...declarations].sort((a, b) => {
        const ap = a.source.path, bp = b.source.path
        for (let i = 0; i < Math.min(ap.length, bp.length); i++)
          if (ap[i] !== bp[i]) return ap[i] - bp[i]
        return ap.length - bp.length
      }).map((d) => d.source.path.join('.'))
    )
    expect(new Set(source.consumed)).toEqual(new Set(inventory.definitions.map((d) => d.id)))
    for (const definition of inventory.definitions) {
      const declaration = declarations.find((d) => d.componentId === definition.id)
      expect(declaration.source).toEqual({
        partUri, preconditionHash: definition.preconditionHash,
        path: definition.componentLocators[0].path,
      })
    }
    expect(normalizeSmartArtDocument(JSON.parse(JSON.stringify(document)))).toEqual(document)
  })

  it.each([[1, 'first'], [2, 'second'], [3, 'fallback']])(
    'evaluates count %i using the first matching branch or else', async (count, label) => {
      const { document } = await fixture({ count, change: sourceChoose })
      const result = evaluateSmartArtLayout(document, bounds)
      expect(result.placements).toHaveLength(count)
      expect(result.placements.map((p) => p.styleLabel)).toEqual(Array(count).fill(label))
      expect(result.placements.map((p) => [p.modelId, p.x, p.y, p.width, p.height])).toEqual(
        Array.from({ length: count }, (_, i) => [String(i + 1), i * 50, 0, 40, 50])
      )
      expect(result.placements.every((p) => p.source.path[3] === ['first', 'second', 'fallback'].indexOf(label))).toBe(true)
    }
  )

  it('allows multiple if branches without an else', async () => {
    const { document } = await admission((xml) => xml.replace(/<d:else[\s\S]*?<\/d:else>/, ''))
    expect(document.layout.declarations.find((d) => d.type === 'choose').children).toHaveLength(2)
  })

  it.each([
    ['else first', (branches) => { branches[0].type = 'else'; branches[0].attributes = {} }],
    ['duplicate else', (branches) => { branches[1].type = 'else'; branches[1].attributes = {} }],
    ['unsupported function', (branches) => { branches[0].attributes.func = 'var' }],
    ['invalid numeric value', (branches) => { branches[0].attributes.val = 'NaN' }],
  ])('rejects direct model %s without relying on XML checks', async (_, change) => {
    const { document } = await admission()
    const changed = JSON.parse(JSON.stringify(document))
    const declarations = changed.layout.declarations
    const choose = declarations.find((d) => d.type === 'choose')
    const branches = choose.children.map((id) => declarations.find((d) => d.componentId === id))
    change(branches)
    expect(() => normalizeSmartArtDocument(changed)).toThrow(/Unsupported PPTX SmartArt layout/)
  })

  it.each([
    ['empty choose', () => '<d:choose/>', 'choose', [0, 0, 2]],
    ['else without if', () => '<d:choose><d:else/></d:choose>', 'else', [0, 0, 2, 0]],
    ['else before if', (x) => x.replace(/(<d:if[\s\S]*?<\/d:if>)([\s\S]*)(<d:else[\s\S]*?<\/d:else>)/, '$3$1$2'), 'else', [0, 0, 2, 0]],
    ['else between if branches', (x) => x.replace(/(<d:if name="second"[\s\S]*?<\/d:if>)(\s*)(<d:else[\s\S]*?<\/d:else>)/, '$3$2$1'), 'else', [0, 0, 2, 1]],
    ['duplicate else', (x) => x.replace('</d:choose>', '<d:else/></d:choose>'), 'else', [0, 0, 2, 3]],
    ['branch namespace', (x) => x.replace('<d:if', '<d:if xmlns:d="urn:spoof"'), 'if', [0, 0, 2, 0]],
    ['choose namespace', (x) => x.replace('<d:choose', '<d:choose xmlns:d="urn:spoof"'), 'choose', [0, 0, 2]],
    ['unsupported construct in unselected branch', (x) => x.replace('</d:else>', '<d:ruleLst/></d:else>'), 'ruleLst', [0, 0, 2, 2, 1]],
    ['unsupported condition function', (x) => x.replace('func="cnt"', 'func="var"'), 'if', [0, 0, 2, 0]],
    ['unimplemented none function', (x) => x.replace('func="cnt"', 'func="none"'), 'if', [0, 0, 2, 0]],
    ['unsupported condition argument', (x) => x.replace('func="cnt"', 'func="cnt" arg="unknown"'), 'if', [0, 0, 2, 0]],
    ['unsupported condition operation', (x) => x.replace('op="equ"', 'op="bogus"'), 'if', [0, 0, 2, 0]],
    ['missing condition value', (x) => x.replace(' val="1"', ''), 'if', [0, 0, 2, 0]],
    ['missing condition function', (x) => x.replace(' func="cnt"', ''), 'if', [0, 0, 2, 0]],
    ['missing condition operation', (x) => x.replace(' op="equ"', ''), 'if', [0, 0, 2, 0]],
    ['nonnumeric condition value', (x) => x.replace('val="1"', 'val="one"'), 'if', [0, 0, 2, 0]],
    ['nonfinite condition value', (x) => x.replace('val="1"', 'val="1e999"'), 'if', [0, 0, 2, 0]],
    ['coerced hexadecimal condition', (x) => x.replace('val="1"', 'val="0x1"'), 'if', [0, 0, 2, 0]],
  ])('rejects %s at the exact source locator', async (_, change, localName, path) => {
    await expect(admission(change)).rejects.toMatchObject({
      code: 'PPTX_SMARTART_LAYOUT_UNSUPPORTED', status: 422,
      sourceLocation: { partUri, localName, path },
    })
  })
})
