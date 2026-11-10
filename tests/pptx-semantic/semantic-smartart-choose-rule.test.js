import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { normalizeSmartArtLayout } = require('../../shared/src/pptx-smartart-layout-declarations')
const { evaluateSmartArtLayout } = require('../../shared/src/pptx-smartart-layout')

const partUri = 'ppt/diagrams/layout1.xml'
const preconditionHash = 'a'.repeat(64)
const rel = { partUri, preconditionHash }

function makeDecl(id, type, attrs = {}, children = [], path = [0]) {
  return {
    componentId: id,
    type,
    attributes: attrs,
    children,
    source: { partUri, preconditionHash, path },
  }
}

describe('SmartArt choose and rule layout declarations and evaluation', () => {
  it('validates and normalizes choose, if, and else constructs', () => {
    const layout = {
      schemaVersion: 1,
      source: { partUri, preconditionHash },
      rootId: 'root',
      declarations: [
        makeDecl('root', 'layoutDef', { uniqueId: 'test' }, ['lnRoot'], [0]),
        makeDecl('lnRoot', 'layoutNode', {}, ['algComp', 'ch1'], [0, 0]),
        makeDecl('algComp', 'alg', { type: 'comp' }, [], [0, 0, 0]),
        makeDecl('ch1', 'choose', {}, ['if1', 'else1'], [0, 0, 1]),
        makeDecl('if1', 'if', { val: '1', op: 'equ', func: 'cnt' }, ['nodeA'], [0, 0, 1, 0]),
        makeDecl('nodeA', 'layoutNode', {}, ['algLinA'], [0, 0, 1, 0, 0]),
        makeDecl('algLinA', 'alg', { type: 'lin' }, ['pDirA', 'pAlignA'], [0, 0, 1, 0, 0, 0]),
        makeDecl('pDirA', 'param', { type: 'linDir', val: 'fromL' }, [], [0, 0, 1, 0, 0, 0, 0]),
        makeDecl('pAlignA', 'param', { type: 'vertAlign', val: 't' }, [], [0, 0, 1, 0, 0, 0, 1]),
        makeDecl('else1', 'else', {}, ['nodeB'], [0, 0, 1, 1]),
        makeDecl('nodeB', 'layoutNode', {}, ['algLinB'], [0, 0, 1, 1, 0]),
        makeDecl('algLinB', 'alg', { type: 'lin' }, ['pDirB', 'pAlignB'], [0, 0, 1, 1, 0, 0]),
        makeDecl('pDirB', 'param', { type: 'linDir', val: 'fromT' }, [], [0, 0, 1, 1, 0, 0, 0]),
        makeDecl('pAlignB', 'param', { type: 'horzAlign', val: 'l' }, [], [0, 0, 1, 1, 0, 0, 1]),
      ],
    }

    const norm = normalizeSmartArtLayout(layout, rel)
    expect(norm.schemaVersion).toBe(1)
    expect(norm.declarations.find((d) => d.type === 'choose')).toBeDefined()
  })

  it('evaluates choose branch conditionally based on child count function', () => {
    const layout = {
      schemaVersion: 1,
      source: { partUri, preconditionHash },
      rootId: 'root',
      declarations: [
        makeDecl('root', 'layoutDef', { uniqueId: 'test' }, ['lnRoot'], [0]),
        makeDecl('lnRoot', 'layoutNode', {}, ['algComp', 'ch1'], [0, 0]),
        makeDecl('algComp', 'alg', { type: 'comp' }, [], [0, 0, 0]),
        makeDecl('ch1', 'choose', {}, ['if1', 'else1'], [0, 0, 1]),
        makeDecl('if1', 'if', { val: '1', op: 'equ', func: 'cnt' }, ['nodeA'], [0, 0, 1, 0]),
        makeDecl('nodeA', 'layoutNode', {}, ['algLinA', 'presA', 'shapeA', 'cLstA'], [0, 0, 1, 0, 0]),
        makeDecl('algLinA', 'alg', { type: 'lin' }, ['pDirA', 'pAlignA'], [0, 0, 1, 0, 0, 0]),
        makeDecl('pDirA', 'param', { type: 'linDir', val: 'fromL' }, [], [0, 0, 1, 0, 0, 0, 0]),
        makeDecl('pAlignA', 'param', { type: 'vertAlign', val: 't' }, [], [0, 0, 1, 0, 0, 0, 1]),
        makeDecl('presA', 'presOf', { axis: 'des', ptType: 'node' }, [], [0, 0, 1, 0, 0, 1]),
        makeDecl('shapeA', 'shape', { type: 'rect' }, [], [0, 0, 1, 0, 0, 2]),
        makeDecl('cLstA', 'constrLst', {}, ['cA1', 'cA2', 'cA3', 'cA4'], [0, 0, 1, 0, 0, 3]),
        makeDecl('cA1', 'constr', { type: 'w', val: 50 }, [], [0, 0, 1, 0, 0, 3, 0]),
        makeDecl('cA2', 'constr', { type: 'h', val: 50 }, [], [0, 0, 1, 0, 0, 3, 1]),
        makeDecl('cA3', 'constr', { type: 'l', val: 10 }, [], [0, 0, 1, 0, 0, 3, 2]),
        makeDecl('cA4', 'constr', { type: 't', val: 10 }, [], [0, 0, 1, 0, 0, 3, 3]),
        makeDecl('else1', 'else', {}, ['nodeB'], [0, 0, 1, 1]),
        makeDecl('nodeB', 'layoutNode', {}, ['algLinB', 'presB', 'shapeB', 'cLstB'], [0, 0, 1, 1, 0]),
        makeDecl('algLinB', 'alg', { type: 'lin' }, ['pDirB', 'pAlignB'], [0, 0, 1, 1, 0, 0]),
        makeDecl('pDirB', 'param', { type: 'linDir', val: 'fromT' }, [], [0, 0, 1, 1, 0, 0, 0]),
        makeDecl('pAlignB', 'param', { type: 'horzAlign', val: 'l' }, [], [0, 0, 1, 1, 0, 0, 1]),
        makeDecl('presB', 'presOf', { axis: 'des', ptType: 'node' }, [], [0, 0, 1, 1, 0, 1]),
        makeDecl('shapeB', 'shape', { type: 'rect' }, [], [0, 0, 1, 1, 0, 2]),
        makeDecl('cLstB', 'constrLst', {}, ['cB1', 'cB2', 'cB3', 'cB4'], [0, 0, 1, 1, 0, 3]),
        makeDecl('cB1', 'constr', { type: 'w', val: 80 }, [], [0, 0, 1, 1, 0, 3, 0]),
        makeDecl('cB2', 'constr', { type: 'h', val: 80 }, [], [0, 0, 1, 1, 0, 3, 1]),
        makeDecl('cB3', 'constr', { type: 'l', val: 10 }, [], [0, 0, 1, 1, 0, 3, 2]),
        makeDecl('cB4', 'constr', { type: 't', val: 10 }, [], [0, 0, 1, 1, 0, 3, 3]),
      ],
    }

    // SmartArt document with 1 node -> matches if1 (cnt == 1) -> width 50
    const doc1 = {
      schemaVersion: 1,
      componentId: 'saDoc',
      points: [
        { componentId: 'pDoc', modelId: '0', type: 'doc', properties: [] },
        { componentId: 'pNode1', modelId: '1', type: 'node', properties: [] },
      ],
      connections: [
        { componentId: 'c1', modelId: '100', type: 'parOf', sourceId: '0', destinationId: '1', sourceOrder: 0, destinationOrder: 0 },
      ],
      relationships: [
        { role: 'data', relationshipId: 'rIdData', relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData', partUri: 'ppt/diagrams/data1.xml', preconditionHash },
        { role: 'layout', relationshipId: 'rIdLayout', relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout', partUri, preconditionHash },
        { role: 'style', relationshipId: 'rIdStyle', relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramQuickStyle', partUri: 'ppt/diagrams/quickStyle1.xml', preconditionHash },
        { role: 'colors', relationshipId: 'rIdColors', relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramColors', partUri: 'ppt/diagrams/colors1.xml', preconditionHash },
      ],
      layout,
    }

    const res1 = evaluateSmartArtLayout(doc1, { x: 0, y: 0, width: 200, height: 200 })
    expect(res1.placements.length).toBe(1)
    expect(res1.placements[0].width).toBe(50)
  })
})
