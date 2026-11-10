// @vitest-environment node
import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { geometryStyleFixture } from './geometry-style-fixture'

const require = createRequire(import.meta.url)
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { assertSnapshotBudget, canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')

function keys(value) {
  if (!value || typeof value !== 'object') return 0
  let count = 0
  for (const k of Object.keys(value)) {
    count += 1 + keys(value[k])
  }
  return count
}

function graphFixture(extraComponents = 0) {
  const input = geometryProjectionFixture()
  const components = input.pptxSemantic.definitions.definition.components
  // Distinct deep source locators cross the key boundary without requiring
  // thousands of independent projected components; array indices still count.
  for (let index = 0; index < extraComponents; index++) {
    components.push({ id: `source-property-${index}`, kind: 'property',
      locator: { path: [1, ...Array(100).fill(0), index], preconditionHash: 'a'.repeat(64) } })
  }
  input.pptxSemantic = compactSemanticGraph(input.pptxSemantic)
  return input
}

function passthroughKeys(input) {
  return keys({ ...input, pptxSemantic: undefined })
}

describe('schema three typed snapshot accounting', () => {
  it('publishes and reopens a validated graph over 100000 keys without losing source components', () => {
    const input = graphFixture(1000)
    const before = JSON.stringify(input)
    expect(keys(input.pptxSemantic)).toBeGreaterThan(100000)
    expect(Buffer.byteLength(JSON.stringify(input.pptxSemantic))).toBeLessThan(8 * 1024 * 1024)
    expect(isDeepStrictEqual(normalizePptxSemanticDocument(input.pptxSemantic), input.pptxSemantic)).toBe(true)
    const published = canonicalEditableSnapshot(input)
    expect(isDeepStrictEqual(published.pptxSemantic, input.pptxSemantic)).toBe(true)
    expect(isDeepStrictEqual(canonicalEditableSnapshot(JSON.parse(JSON.stringify(published))), published)).toBe(true)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('charges the root envelope key and every nonsemantic property at the exact key boundary', () => {
    const input = graphFixture()
    const limit = passthroughKeys(input)
    expect(assertSnapshotBudget(input, { maxObjectKeys: limit })).toBe(Buffer.byteLength(JSON.stringify(input)))
    expect(() => assertSnapshotBudget(input, { maxObjectKeys: limit - 1 })).toThrow(/passthrough properties/)
  })

  it.each([1, 2])('retains schema %i aggregate key accounting', schemaVersion => {
    const input = geometryProjectionFixture()
    if (schemaVersion === 2) input.pptxSemantic = geometryStyleFixture()
    else input.pptxSemantic.schemaVersion = schemaVersion
    normalizePptxSemanticDocument(input.pptxSemantic)
    expect(() => assertSnapshotBudget(input, { maxObjectKeys: passthroughKeys(input) })).toThrow(/passthrough properties/)
  })

  it.each([false, true])('rejects plugin key overflow beside a valid graph, semantic first=%s', semanticFirst => {
    const input = graphFixture()
    const extension = Array(100000).fill(0)
    const snapshot = semanticFirst ? { ...input, extension } : { extension, ...input }
    expect(() => assertSnapshotBudget(snapshot)).toThrow(/passthrough properties/)
  })

  it('does not grant nested semantic lookalikes typed key accounting', () => {
    const input = graphFixture()
    input.extension = { pptxSemantic: input.pptxSemantic }
    const limit = passthroughKeys({ ...input, extension: undefined })
    expect(() => assertSnapshotBudget(input, { maxObjectKeys: limit, maxDepth: 256 })).toThrow(/passthrough properties/)
  })

  it('validates schema three authority before applying typed accounting', () => {
    const input = graphFixture()
    input.pptxSemantic.unknown = true
    expect(() => assertSnapshotBudget(input)).toThrow(/semantic schema/)
  })

  it('continues charging semantic strings to the aggregate string budget', () => {
    const input = graphFixture()
    const strings = value => typeof value === 'string' ? Buffer.byteLength(value)
      : value && typeof value === 'object' ? Object.values(value).reduce((n, child) => n + strings(child), 0) : 0
    const total = strings(input)
    expect(assertSnapshotBudget(input, { maxStringBytes: total })).toBe(Buffer.byteLength(JSON.stringify(input)))
    expect(() => assertSnapshotBudget(input, { maxStringBytes: total - 1 })).toThrow(/strings/)
  })

  it('continues charging the entire graph to the encoded snapshot byte budget', () => {
    const input = graphFixture()
    const total = Buffer.byteLength(JSON.stringify(input))
    expect(assertSnapshotBudget(input, { maxSnapshotBytes: total })).toBe(total)
    expect(() => assertSnapshotBudget(input, { maxSnapshotBytes: total - 1 })).toThrow(/aggregate bytes/)
  })
})
