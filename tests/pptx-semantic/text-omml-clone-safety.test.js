import { describe, expect, it } from 'vitest'
import { cloneTextData, normalizeTextDocument, TEXT_DOCUMENT_LIMITS } from '../../shared/src/pptx-text-document'
import { OMML_LIMITS } from '../../shared/src/pptx-omml-document'

const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
function equation(levels = 8) {
  let serial = 0
  const node = (type, children = [], extra = {}) => ({
    componentId: `math:${serial++}`, namespaceUri: M, type, attributes: [], children, ...extra,
  })
  let atom = node('r', [node('t', [], { text: 'x' })])
  for (let i = 0; i < levels; i++) atom = node('box', [node('e', [atom])])
  return { kind: 'equation', componentId: 'run', ommlDocument: { schemaVersion: 1, root: node('oMath', [atom]) } }
}
const document = (run) => ({ schemaVersion: 1, componentId: 'text', paragraphs: [{ componentId: 'paragraph', runs: [run] }] })
function measure(value) {
  let nodes = 1, bytes = typeof value === 'string' ? value.length * 2 : 0
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    const part = measure(child)
    nodes += part.nodes
    bytes += key.length * 2 + 16 + part.bytes
  }
  return { nodes, bytes }
}
function atNodeBudget() {
  const value = { islands: Array.from({ length: 2 }, () => ({ kind: 'equation', ommlDocument: Array(30000).fill(null) })), padding: [] }
  let remaining = TEXT_DOCUMENT_LIMITS.maxNodes - measure(value).nodes
  while (remaining) {
    const count = Math.min(60000, remaining - 1)
    value.padding.push(Array(count).fill(null))
    remaining -= count + 1
  }
  return value
}

describe('text clone OMML safety composition', () => {
  it('preserves a mutable deep typed equation without relaxing ordinary text depth', () => {
    const input = document(equation())
    const output = normalizeTextDocument(input)
    expect(output).toEqual(input)
    expect(JSON.parse(JSON.stringify(output))).toEqual(input)
    output.paragraphs[0].runs[0].ommlDocument.root.type = 'changed'
    expect(input.paragraphs[0].runs[0].ommlDocument.root.type).toBe('oMath')
    let generic = {}
    for (let i = 0; i < TEXT_DOCUMENT_LIMITS.maxDepth + 1; i++) generic = { child: generic }
    expect(() => cloneTextData({ ommlDocument: generic })).toThrow(/JSON budget/)
    expect(() => cloneTextData({ kind: 'text', ommlDocument: generic })).toThrow(/JSON budget/)
  })

  it('rejects an equation island in an invalid document field at semantic validation', () => {
    const input = document(equation())
    input.body = equation()
    expect(() => normalizeTextDocument(input)).toThrow(TypeError)
    input.body = undefined
    delete input.body
    input.paragraphs[0].runs[0].ommlDocument.root.type = 'future'
    expect(() => normalizeTextDocument(input)).toThrow(/OMML contract/)
  })

  it.each([true, false])('never reads accessors with OMML-first ordering %s', (ommlFirst) => {
    let reads = 0
    const input = ommlFirst ? { ommlDocument: equation().ommlDocument } : {}
    Object.defineProperty(input, 'kind', { enumerable: true, get() { reads++; return 'equation' } })
    if (!ommlFirst) input.ommlDocument = equation().ommlDocument
    expect(() => cloneTextData(input)).toThrow(TypeError)
    const run = { kind: 'equation' }
    Object.defineProperty(run, 'ommlDocument', { enumerable: true, get() { reads++; return {} } })
    expect(() => cloneTextData(run)).toThrow(TypeError)
    expect(reads).toBe(0)
  })

  it.each(['prototype', 'accessor', 'cycle', 'outer-cycle', 'symbol', 'magic', 'hole'])('rejects %s inside the handoff', (kind) => {
    const input = equation(0), subtree = input.ommlDocument
    if (kind === 'prototype') Object.setPrototypeOf(subtree.root, null)
    if (kind === 'accessor') Object.defineProperty(subtree.root, 'text', { enumerable: true, get() { throw new Error('invoked') } })
    if (kind === 'cycle') subtree.root.children.push(subtree.root)
    if (kind === 'outer-cycle') subtree.root.children.push(input)
    if (kind === 'symbol') subtree.root[Symbol('extra')] = 1
    if (kind === 'magic') Object.defineProperty(subtree.root, '__proto__', { enumerable: true, value: {} })
    if (kind === 'hole') delete subtree.root.children[0]
    expect(() => cloneTextData(input)).toThrow(TypeError)
  })

  it('counts all primitive nodes across islands and outer siblings at the exact aggregate limit', () => {
    const input = atNodeBudget()
    expect(measure(input).nodes).toBe(TEXT_DOCUMENT_LIMITS.maxNodes)
    expect(cloneTextData(input)).toEqual(input)
    input.islands[0].ommlDocument.push(false)
    expect(measure(input).nodes).toBe(TEXT_DOCUMENT_LIMITS.maxNodes + 1)
    expect(() => cloneTextData(input)).toThrow(/JSON budget/)
  })

  it('charges strings and array index keys exactly across multiple handoffs', () => {
    const input = [{ kind: 'equation', ommlDocument: [''] }, { kind: 'equation', ommlDocument: [''] }]
    const available = (TEXT_DOCUMENT_LIMITS.maxBytes - measure(input).bytes) / 2
    input[0].ommlDocument[0] = 'x'.repeat(Math.floor(available / 2))
    input[1].ommlDocument[0] = 'y'.repeat(available - input[0].ommlDocument[0].length)
    expect(measure(input).bytes).toBe(TEXT_DOCUMENT_LIMITS.maxBytes)
    expect(cloneTextData(input)).toEqual(input)
    input[1].ommlDocument[0] += 'z'
    expect(() => cloneTextData(input)).toThrow(/JSON bytes/)
  })

  it('retains the OMML-specific depth rejection and rejects repeated handoff depth resets', () => {
    let subtree = {}
    for (let i = 0; i < OMML_LIMITS.maxDepth * 2 + 9; i++) subtree = { child: subtree }
    expect(() => cloneTextData({ kind: 'equation', ommlDocument: subtree })).toThrow(/OMML contract: JSON budget/)
    let nested = {}
    for (let i = 0; i < 150; i++) nested = { kind: 'equation', ommlDocument: nested }
    expect(() => cloneTextData(nested)).toThrow(/OMML contract: JSON budget/)
  })
})
