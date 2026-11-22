import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { collectSemanticFontRequests } = require('../../shared/src/pptx-source-font-request')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')

function model() {
  const hash = 'a'.repeat(64)
  return {
    schemaVersion: 1,
    definitions: { d: { id: 'd', kind: 'text',
      source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: hash },
      components: ['body', 'paragraph', 'run'].map((id, i) => ({
        id, kind: i === 2 ? 'run' : 'paragraph',
        locator: { path: [0, i], preconditionHash: hash },
      })),
      content: { textDocument: { schemaVersion: 1, componentId: 'body', body: {},
        paragraphs: [{ componentId: 'paragraph', properties: {},
          defaultRunProperties: { fontLatin: { typeface: 'Original' } },
          runs: [{ componentId: 'run', kind: 'text', text: 'Source', properties: {} }],
        }],
      } },
    } },
    instances: { i: { id: 'i', slideId: 's', definitionId: 'd', parentInstanceId: null,
      localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {},
    } },
    styles: {}, fonts: {},
  }
}

describe('source font request cache snapshot boundaries', () => {
  it('normalizes shallow-frozen inputs again after nested font edits and invalid mutations', () => {
    const source = Object.freeze(model())
    const initial = collectSemanticFontRequests(source)
    source.definitions.d.content.textDocument.paragraphs[0]
      .defaultRunProperties.fontLatin.typeface = 'Changed'
    const changed = collectSemanticFontRequests(source)
    expect(changed.faces.map(face => face.typeface)).toEqual(['Changed'])
    expect(changed.identity).not.toBe(initial.identity)
    expect(initial.faces.map(face => face.typeface)).toEqual(['Original'])
    source.instances.i.definitionId = 'missing'
    expect(() => collectSemanticFontRequests(source)).toThrow()
  })

  it('reads changed definitions with a shared immutable instance and caches each normalized document', () => {
    const source = normalizePptxSemanticDocument(model())
    const initial = collectSemanticFontRequests(source)
    const definition = structuredClone(source.definitions.d)
    definition.content.textDocument.paragraphs[0].defaultRunProperties.fontLatin.typeface = 'Changed'
    const changed = normalizePptxSemanticDocument({ ...source,
      definitions: { ...source.definitions, d: definition },
    })
    expect(changed.instances.i).toBe(source.instances.i)
    const result = collectSemanticFontRequests(changed)
    expect(result.faces.map(face => face.typeface)).toEqual(['Changed'])
    expect(result.identity).not.toBe(initial.identity)
    expect(collectSemanticFontRequests(source)).toBe(initial)
    expect(collectSemanticFontRequests(changed)).toBe(result)
  })

  it('updates issue locations when an occurrence edit keeps the same issue count', () => {
    const raw = model()
    raw.definitions.d.content.textDocument.paragraphs[0].defaultRunProperties = {}
    const source = normalizePptxSemanticDocument(raw)
    const initial = collectSemanticFontRequests(source)
    const textDocument = structuredClone(source.definitions.d.content.textDocument)
    textDocument.paragraphs[0].runs[0].componentId = 'replacement'
    const changed = normalizePptxSemanticDocument({ ...source, instances: {
      i: { ...source.instances.i, overrides: { components: { body: { textDocument } } } },
    } })
    expect(changed.definitions).toBe(source.definitions)
    expect(changed.styles).toBe(source.styles)
    const result = collectSemanticFontRequests(changed)
    expect(initial.issues).toEqual([expect.objectContaining({ componentId: 'run' })])
    expect(result.issues).toEqual([expect.objectContaining({ componentId: 'replacement' })])
    expect(result.identity).not.toBe(initial.identity)
  })

  it('includes changed schema-3 source catalogs even when dictionaries and instances are shared', () => {
    const source = normalizePptxSemanticDocument(compactSemanticGraph(model()))
    const initial = collectSemanticFontRequests(source)
    const changed = normalizePptxSemanticDocument({ ...source,
      partUris: source.partUris.map(part => part === 'ppt/slides/slide1.xml'
        ? 'ppt/slides/slide2.xml' : part),
    })
    expect(changed.definitions).toBe(source.definitions)
    expect(changed.instances).toBe(source.instances)
    expect(changed.styles).toBe(source.styles)
    const result = collectSemanticFontRequests(changed)
    expect(result.faces).toEqual(initial.faces)
    expect(result.locations['source-0']).toEqual([
      expect.objectContaining({ part: 'ppt/slides/slide2.xml' }),
    ])
    expect(result.identity).not.toBe(initial.identity)
  })

  it('keeps script slots and run style flags distinct when declarations repeat', () => {
    const raw = model()
    const paragraph = raw.definitions.d.content.textDocument.paragraphs[0]
    paragraph.defaultRunProperties = {
      fontLatin: { typeface: 'Latin' }, fontEastAsian: { typeface: 'East Asian' },
      fontComplexScript: { typeface: 'Complex' }, bold: false, italic: false,
    }
    const entries = [
      ['run', '…', {}], ['east', '中', { bold: true }],
      ['complex', 'ع', { italic: true }], ['latin', '\nA', {}],
    ]
    paragraph.runs = entries.map(([componentId, text, properties]) => ({
      componentId, kind: 'text', text, properties,
    }))
    for (const [id] of entries.slice(1)) raw.definitions.d.components.push({
      ...raw.definitions.d.components[2], id,
    })
    const source = normalizePptxSemanticDocument(raw)
    const initial = collectSemanticFontRequests(source)
    const signatures = result => result.faces.map(({ typeface, bold, italic }) => [typeface, bold, italic])
    expect(signatures(initial)).toEqual([
      ['Complex', false, true], ['East Asian', false, false],
      ['East Asian', true, false], ['Latin', false, false],
    ])
    expect(initial.issues).toEqual([])
    const textDocument = structuredClone(source.definitions.d.content.textDocument)
    textDocument.paragraphs[0].runs[1].text = 'A'
    const changed = normalizePptxSemanticDocument({ ...source, instances: {
      i: { ...source.instances.i, overrides: { components: { body: { textDocument } } } },
    } })
    const result = collectSemanticFontRequests(changed)
    expect(signatures(result)).toEqual([
      ['Complex', false, true], ['Latin', false, false], ['Latin', true, false],
    ])
    expect(result.identity).not.toBe(initial.identity)
    expect(collectSemanticFontRequests(source)).toBe(initial)
  })
})
