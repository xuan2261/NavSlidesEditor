import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { arg, doc, node, run, val } from './omml-rendering-fixtures.js'

const require = createRequire(import.meta.url)
const api = () => require('../../shared/src/pptx-omml-operations.js')
function authored(root, value) {
  let index = 0
  const visit = (item) => ({
    ...item,
    componentId: `${root}~authored:test-${++index}`,
    children: item.children.map(visit),
  })
  return visit(value)
}

describe('immutable source-bound OMML operations', () => {
  it.each(['r', 'f', 'sSub', 'sSup', 'sSubSup', 'sPre', 'rad', 'nary', 'm', 'd', 'eqArr'])(
    'inserts an editable %s with explicit stable authored IDs',
    (type) => {
      const { createOmmlStructure } = require('../../shared/src/pptx-omml-operations-presets.js')
      const input = doc()
      const added = createOmmlStructure(input, type, 'caller-token')
      const command = { type: 'insert', componentId: input.root.componentId, index: 0, node: added }
      const once = api().applyOmmlOperation(input, command)
      expect(once.root.children[0]).toEqual(added)
      expect(api().applyOmmlOperation(JSON.parse(JSON.stringify(input)),
        JSON.parse(JSON.stringify(command)))).toEqual(once)
      expect(() => api().applyOmmlOperation(once, command)).toThrow(/identity/)
    }
  )
  it.each(['f', 'sSubSup', 'rad', 'nary', 'm', 'd', 'eqArr'])(
    'edits a run in %s without flattening native structure or identities',
    (type) => {
      const children = {
        f: [arg('num', 'x'), arg('den', 'y')],
        sSubSup: [arg('e', 'x'), arg('sub', 'i'), arg('sup', '2')],
        rad: [arg('deg', '3'), arg('e', 'x')],
        nary: [arg('sub', 'i'), arg('sup', 'n'), arg('e', 'x')],
        m: [node('mr', [arg('e', 'x'), arg('e', 'y')])],
        d: [arg('e', 'x'), arg('e', 'y')],
        eqArr: [arg('e', 'x'), arg('e', 'y')],
      }[type]
      const input = doc(node(type, children))
      const snapshot = JSON.stringify(input)
      let target = children[0]
      while (target.type !== 't') target = target.children[0]
      const result = api().applyOmmlOperation(input, {
        type: 'setText', componentId: target.componentId, text: ' α & β ',
      })
      expect(JSON.stringify(input)).toBe(snapshot)
      const expected = JSON.parse(snapshot)
      const update = (item) => {
        if (item.componentId === target.componentId) item.text = ' α & β '
        item.children.forEach(update)
      }
      update(expected.root)
      expect(result).toEqual(expected)
      expect(Object.isFrozen(result.root.children[0])).toBe(true)
      expect(JSON.parse(JSON.stringify(result))).toEqual(expected)
    }
  )

  it('inserts structured fractions, replaces a selected atom and removes it by ID', () => {
    const input = doc(run('x'))
    const root = input.root.componentId
    const fraction = authored(root, node('f', [arg('num', 'a'), arg('den', 'b')]))
    const inserted = api().applyOmmlOperation(input, {
      type: 'insert', componentId: root, index: 1, node: fraction,
    })
    const replacement = { ...authored(root, node('f', [arg('num', 'z'), arg('den', 'w')])),
      componentId: fraction.componentId }
    const result = api().applyOmmlOperations(inserted, [
      { type: 'replace', componentId: fraction.componentId, node: replacement },
      { type: 'remove', componentId: fraction.componentId },
    ])
    expect(result).toEqual(input)
    expect(inserted.root.children[0]).toEqual(input.root.children[0])
  })

  it.each([
    (d) => ({ type: 'remove', componentId: d.root.componentId }),
    (d) => ({ type: 'setText', componentId: d.root.componentId, text: 'x' }),
    () => ({ type: 'remove', componentId: 'missing' }),
    (d) => ({ type: 'insert', componentId: d.root.componentId, index: 1.5, node: run('x') }),
    (d) => ({ type: 'insert', componentId: d.root.componentId, index: 0, node: run('x') }),
    (d) => ({ type: 'replace', componentId: d.root.children[0].componentId,
      node: { ...node('rad', [node('deg'), node('e')]),
        componentId: d.root.children[0].componentId } }),
    (d) => ({ type: 'setText', componentId: d.root.children[0].children[0].componentId,
      text: '\u0000' }),
    (d) => ({ type: 'remove', componentId: d.root.children[0].componentId, extra: true }),
  ])('rejects invalid commands atomically', (command) => {
    const { applyOmmlOperation } = api()
    const input = doc(run('source'))
    const before = JSON.stringify(input)
    expect(() => applyOmmlOperation(input, command(input))).toThrow()
    expect(JSON.stringify(input)).toBe(before)
  })

  it('rejects a property getter without invoking it and invalid replay suffixes', () => {
    const { applyOmmlOperation, applyOmmlOperations } = api()
    const input = doc(run('x'))
    let invoked = false
    const command = { type: 'remove', componentId: input.root.children[0].componentId }
    Object.defineProperty(command, 'type', { enumerable: true, get() { invoked = true; return 'remove' } })
    expect(() => applyOmmlOperation(input, command)).toThrow()
    expect(invoked).toBe(false)
    expect(() => applyOmmlOperations(input, [
      { type: 'remove', componentId: input.root.children[0].componentId },
      { type: 'remove', componentId: 'missing' },
    ])).toThrow()
    expect(input.root.children).toHaveLength(1)
  })

  it('rejects accessor-backed journals before executing their getters', () => {
    const input = doc(run('x'))
    const commands = []
    let invoked = false
    Object.defineProperty(commands, '0', { enumerable: true, get() {
      invoked = true
      return { type: 'remove', componentId: input.root.children[0].componentId }
    } })
    expect(() => api().applyOmmlOperations(input, commands)).toThrow()
    expect(invoked).toBe(false)
  })

  it('creates property commands that mutate target property and preserve node IDs', () => {
    const { createOmmlPropertyCommand } = require('../../shared/src/pptx-omml-operations-structure.js')
    const input = doc(node('f', [arg('num', 'x'), arg('den', 'y')]))
    const frac = input.root.children[0]
    const cmd = createOmmlPropertyCommand(input, frac.componentId, 'type', 'lin', 'tok-f')
    expect(cmd.type).toBe('replace')
    expect(cmd.componentId).toBe(frac.componentId)
    const res = api().applyOmmlOperation(input, cmd)
    const fPr = res.root.children[0].children.find((c) => c.type === 'fPr')
    expect(fPr.children.find((c) => c.type === 'type').attributes[0].value).toBe('lin')
    // Existing numerator and denominator component IDs are preserved
    expect(res.root.children[0].children.find((c) => c.type === 'num').componentId)
      .toBe(frac.children[0].componentId)
  })

  it('creates matrix commands that insert/remove rows and columns and maintain column declarations', () => {
    const { createOmmlMatrixCommand } = require('../../shared/src/pptx-omml-operations-structure.js')
    const mcsDecl = node('mcs', [
      node('mc', [node('mcPr', [val('count', '2')])]),
    ])
    const input = doc(node('m', [
      node('mPr', [mcsDecl]),
      node('mr', [arg('e', '1'), arg('e', '2')]),
      node('mr', [arg('e', '3'), arg('e', '4')]),
    ]))
    const matrixNode = input.root.children[0]
    // Insert column at index 1
    const colInsertCmd = createOmmlMatrixCommand(input, matrixNode.componentId,
      { axis: 'column', action: 'insert', index: 1 }, 'tok-m1')
    const afterCol = api().applyOmmlOperation(input, colInsertCmd)
    const rowsCol = afterCol.root.children[0].children.filter((c) => c.type === 'mr')
    expect(rowsCol[0].children).toHaveLength(3)
    expect(rowsCol[1].children).toHaveLength(3)
    // Delete row at index 0
    const rowDelCmd = createOmmlMatrixCommand(afterCol, matrixNode.componentId,
      { axis: 'row', action: 'remove', index: 0 }, 'tok-m2')
    const afterRow = api().applyOmmlOperation(afterCol, rowDelCmd)
    const rowsRow = afterRow.root.children[0].children.filter((c) => c.type === 'mr')
    expect(rowsRow).toHaveLength(1)
    expect(rowsRow[0].children).toHaveLength(3)
  })

  it('rejects invalid property values and out-of-bounds matrix requests without modifying input', () => {
    const { createOmmlPropertyCommand, createOmmlMatrixCommand } =
      require('../../shared/src/pptx-omml-operations-structure.js')
    const input = doc(node('f', [arg('num', 'a'), arg('den', 'b')]))
    const before = JSON.stringify(input)
    expect(() => createOmmlPropertyCommand(input, input.root.children[0].componentId,
      'type', 'invalid_val', 'tok-bad')).toThrow(/unsupported property/)
    expect(() => createOmmlMatrixCommand(input, input.root.children[0].componentId,
      { axis: 'row', action: 'insert', index: 0 }, 'tok-bad')).toThrow(/matrix target/)
    expect(JSON.stringify(input)).toBe(before)
  })
})
