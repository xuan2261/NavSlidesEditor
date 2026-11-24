import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { collectSemanticFontRequests: collect } = require('../../shared/src/pptx-source-font-request')
const { normalizePptxSemanticDocument: normalize } = require('../../shared/src/pptx-semantic-document')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')

function model() {
  const hash = 'a'.repeat(64)
  return {
    schemaVersion: 1,
    definitions: { d: { id: 'd', kind: 'text',
      source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: hash },
      components: ['body', 'paragraph', 'run'].map((id, i) => ({ id,
        kind: i === 2 ? 'run' : 'paragraph', locator: { path: [0, i], preconditionHash: hash } })),
      content: { textDocument: { schemaVersion: 1, componentId: 'body', body: {},
        paragraphs: [{ componentId: 'paragraph', properties: {},
          defaultRunProperties: { fontLatin: { typeface: 'Original' } },
          runs: [{ componentId: 'run', kind: 'text', text: 'Source', properties: {} }],
        }],
      } },
    } },
    instances: Object.fromEntries(['z', 'a'].map(id => [id, { id, slideId: 's', definitionId: 'd',
      parentInstanceId: null, localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} }])),
    styles: {}, fonts: {},
  }
}
function edit(source, change) {
  const textDocument = structuredClone(source.definitions.d.content.textDocument)
  change(textDocument.paragraphs[0])
  return normalize({ ...source, instances: { ...source.instances,
    a: { ...source.instances.a, overrides: { components: { body: { textDocument } } } },
  } })
}
// A separately normalized/deep-cloned document cannot hit the composition's
// dependency envelope. Compare the entire public output, including identity bytes.
function expectColdEquivalent(document, result) {
  expect(collect(structuredClone(document))).toEqual(result)
}

describe('native latency font composition', () => {
  it('reuses the whole owned immutable result after Latin typing, not merely equal faces', () => {
    const source = normalize(model())
    const initial = collect(source)
    const changed = edit(source, paragraph => { paragraph.runs[0].text += ' typed' })
    const result = collect(changed)
    expect(result).toBe(initial)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.locations['source-0'][0])).toBe(true)
    expectColdEquivalent(changed, result)
  })

  it('invalidates same-count issue location changes and preserves ordered diagnostics', () => {
    const raw = model()
    raw.definitions.d.content.textDocument.paragraphs[0].defaultRunProperties = {}
    const source = normalize(raw)
    const initial = collect(source)
    const changed = edit(source, paragraph => { paragraph.runs[0].componentId = 'replacement' })
    const result = collect(changed)
    expect(result).not.toBe(initial)
    expect(result.issues.map(issue => [issue.instanceId, issue.componentId])).toEqual([
      ['a', 'replacement'], ['z', 'run'],
    ])
    expect(result.identity).not.toBe(initial.identity)
    expectColdEquivalent(changed, result)
  })

  it('checks full membership, removal, tombstones, and source provenance rather than face counts', () => {
    const source = normalize(model())
    const initial = collect(source)
    const removed = normalize({ ...source, instances: { a: source.instances.a } })
    const result = collect(removed)
    expect(result).not.toBe(initial)
    expect(result.locations['source-0'].map(location => location.instanceId)).toEqual(['a'])
    expectColdEquivalent(removed, result)
    collect(source)
    const tombstoned = normalize({ ...source, instances: { ...source.instances,
      z: { ...source.instances.z, lineage: { tombstone: true } },
    } })
    expect(collect(tombstoned)).toEqual(result)
    const definition = structuredClone(source.definitions.d)
    definition.source.nativeId = '2'
    collect(source)
    const provenance = normalize({ ...source, definitions: { d: definition } })
    const changed = collect(provenance)
    expect(changed.faces).toEqual(initial.faces)
    expect(changed.locations).toEqual(initial.locations)
    expect(changed.identity).not.toBe(initial.identity)
    expectColdEquivalent(provenance, changed)
  })

  it('does not reuse across changed style/font envelopes or compact source catalogs', () => {
    const source = normalize(model())
    const initial = collect(source)
    const fonts = normalize({ ...source, fonts: { ...source.fonts } })
    // Normalization may canonicalize empty maps; a fresh cloned envelope must
    // still not be used as an identity-based cross-document shortcut.
    const fresh = normalize(structuredClone(fonts))
    expect(collect(fresh)).not.toBe(initial)
    expect(collect(fresh)).toEqual(initial)
    const compact = normalize(compactSemanticGraph(model()))
    const before = collect(compact)
    const moved = normalize({ ...compact, partUris: compact.partUris.map(part =>
      part === 'ppt/slides/slide1.xml' ? 'ppt/slides/slide2.xml' : part) })
    const after = collect(moved)
    expect(after.faces).toEqual(before.faces)
    expect(after.locations['source-0'][0].part).toBe('ppt/slides/slide2.xml')
    expect(after.identity).not.toBe(before.identity)
    expectColdEquivalent(moved, after)
  })

  it('revalidates raw mutations and does not skip the aggregate face budget', () => {
    const raw = model()
    collect(raw)
    raw.instances.a.definitionId = 'missing'
    expect(() => collect(raw)).toThrow()
    const source = normalize(model())
    collect(source)
    const changed = edit(source, paragraph => {
      paragraph.runs = Array.from({ length: 257 }, (_, index) => ({
        componentId: `r${index}`, kind: 'text', text: 'A',
        properties: { fontLatin: { typeface: `Font ${index}` } },
      }))
    })
    expect(() => collect(changed)).toThrow('Source font face budget')
  })
})
