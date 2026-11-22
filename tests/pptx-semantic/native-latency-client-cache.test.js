import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture'

const require = createRequire(import.meta.url)
const { normalizePptxSemanticDocument: normalize } = require('../../shared/src/pptx-semantic-document')
const { collectSemanticFontRequests: collect } = require('../../shared/src/pptx-source-font-request')
const { materializeTextDocument: text } = require('../../shared/src/pptx-text-materialization')
const { semanticRenderTree: tree } = require('../../shared/src/pptx-semantic-render-tree')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')

function fixture() {
  const deck = geometryProjectionFixture()
  const definition = deck.pptxSemantic.definitions.definition
  definition.components.push(...['body', 'paragraph', 'run'].map((id, index) => ({
    id, kind: index === 2 ? 'run' : 'paragraph',
    locator: { path: [1, index], preconditionHash: 'a'.repeat(64) },
  })))
  definition.content.textDocument = {
    schemaVersion: 1, componentId: 'body', body: {},
    paragraphs: [{ componentId: 'paragraph', properties: {},
      defaultRunProperties: { fontLatin: { typeface: 'Original' } },
      runs: [{ componentId: 'run', kind: 'field', text: 'Stored', properties: {},
        field: { id: 'field', type: 'datetime1' } }],
    }],
  }
  return deck
}

function attemptMutation(value, key, replacement) {
  try { value[key] = replacement } catch { /* Read-only output is permitted. */ }
}

describe('native latency cache behavioral boundaries', () => {
  it.each([false, true])('memoizes certified successful inputs only under exact budgets, wire %s', wire => {
    const { certifyImmutableSemanticDocument: certify } = require('../../shared/src/pptx-semantic-records')
    const freeze = value => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
      return value
    }
    const raw = fixture().pptxSemantic
    const input = certify(freeze(wire ? compactSemanticGraph(raw) : raw))
    const admitted = normalize(input, { maxBytes: 16 * 1024 * 1024 })
    expect(normalize(input, { maxBytes: 16 * 1024 * 1024 })).toBe(admitted)
    for (const limits of [{ maxBytes: 128 }, { maxDepth: 1 }, { maxComponents: 1 }]) {
      expect(() => normalize(input, limits)).toThrow(/budget/i)
      expect(() => normalize(admitted, limits)).toThrow(/budget/i)
    }
    expect(normalize(input, { maxBytes: 16 * 1024 * 1024 })).toBe(admitted)
    const invalid = certify(freeze({ ...input, instances: {} , unexpected: true }))
    expect(() => normalize(invalid)).toThrow()
    expect(() => normalize(invalid)).toThrow()
  })

  it('does not let callers corrupt cached font faces, locations or materialized text', () => {
    const doc = normalize(fixture().pptxSemantic)
    const initial = collect(doc)
    const identity = initial.identity
    attemptMutation(initial.faces[0], 'typeface', 'Poison')
    attemptMutation(initial.locations['source-0'][0], 'part', 'poison.xml')
    const materialized = text(doc, 'i1')
    attemptMutation(materialized.paragraphs[0].runs[0], 'text', 'Poison')
    expect(collect(doc).faces[0].typeface).toBe('Original')
    expect(collect(doc).locations['source-0'][0].part).toBe('ppt/slides/slide7.xml')
    expect(collect(doc).identity).toBe(identity)
    expect(text(doc, 'i1').paragraphs[0].runs[0].text).toBe('Stored')
  })

  it('evaluates nested mutable date previews on every render without corrupting stored text', () => {
    const deck = fixture()
    const doc = normalize(deck.pptxSemantic)
    const context = { datePreviews: { datetime1: 'First' } }
    const renderedText = () => tree(doc, deck.slides[0], context)[0]
      .element.pptxTextDocument.paragraphs[0].runs[0].text
    expect(renderedText()).toBe('First')
    context.datePreviews.datetime1 = 'Second'
    expect(renderedText()).toBe('Second')
    expect(text(doc, 'i1').paragraphs[0].runs[0].text).toBe('Stored')
  })

  it('refreshes mutable legacy leaves and does not retain caller-mutated render outputs', () => {
    const deck = fixture()
    const doc = normalize(deck.pptxSemantic)
    const slide = deck.slides[0]
    slide.elements.push({ id: 'legacy', type: 'text', content: 'Before', zIndex: 9 })
    const initial = tree(doc, slide)
    initial[0].transform = 'poison'
    slide.elements[1].content = 'After'
    const updated = tree(doc, slide)
    expect(updated[0].transform).toBe('matrix(-1,0,0,1,100,0)')
    expect(updated[1].element.content).toBe('After')
  })

  it('uses changed schema-3 source catalogs for font locations even with shared dictionaries', () => {
    const doc = normalize(compactSemanticGraph(fixture().pptxSemantic))
    const before = collect(doc)
    const changed = normalize({ ...doc,
      partUris: doc.partUris.map(uri => uri === 'ppt/slides/slide7.xml' ? 'ppt/slides/slide8.xml' : uri),
    })
    const after = collect(changed)
    expect(after.locations['source-0'][0].part).toBe('ppt/slides/slide8.xml')
    expect(after.identity).not.toBe(before.identity)
    expect(collect(doc).locations['source-0'][0].part).toBe('ppt/slides/slide7.xml')
  })

  it('revalidates raw shallow-frozen font documents after nested mutation', () => {
    const raw = Object.freeze(fixture().pptxSemantic)
    collect(raw)
    raw.definitions.definition.content.textDocument.paragraphs[0]
      .defaultRunProperties.fontLatin.typeface = 'Changed'
    expect(collect(raw).faces[0].typeface).toBe('Changed')
    raw.instances.i1.definitionId = 'missing'
    expect(() => collect(raw)).toThrow()
  })
})
