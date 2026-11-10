import { describe, expect, it } from 'vitest'
import { normalizeTextDocument } from '../../shared/src/pptx-text-document'

const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const node = (id, type, children = [], text) => ({
  componentId: id, namespaceUri: M, type, attributes: [], children,
  ...(text === undefined ? {} : { text }),
})
function inlineDocument() {
  return {
    schemaVersion: 1, componentId: 'body',
    paragraphs: [{ componentId: 'p', runs: [
      { componentId: 'before', kind: 'text', text: 'Let ' },
      { componentId: 'equation', kind: 'equation', properties: { fontSizePt: 18 },
        ommlDocument: { schemaVersion: 1, root: node('math', 'oMath', [
          node('math-run', 'r', [node('math-text', 't', [], 'x')]),
        ]) } },
      { componentId: 'after', kind: 'text', text: ' be defined.' },
    ] }],
  }
}

describe('canonical inline OMML text runs', () => {
  it('retains ordered text and editable equation AST as one independently cloned body', () => {
    const source = inlineDocument()
    const result = normalizeTextDocument(source)
    expect(result.paragraphs[0].runs).toEqual(source.paragraphs[0].runs)
    result.paragraphs[0].runs[1].ommlDocument.root.children[0].children[0].text = 'y'
    expect(source.paragraphs[0].runs[1].ommlDocument.root.children[0].children[0].text).toBe('x')
    expect(result.paragraphs[0].runs.map(run => run.kind)).toEqual(['text', 'equation', 'text'])
  })

  it('rejects aliasing an equation AST component with an owning text component', () => {
    const source = inlineDocument()
    source.paragraphs[0].runs[1].ommlDocument.root.componentId = 'before'
    expect(() => normalizeTextDocument(source)).toThrow(TypeError)
  })

  it('rejects reused AST identities across two equation runs without mutating input', () => {
    const source = inlineDocument()
    const copy = structuredClone(source.paragraphs[0].runs[1])
    copy.componentId = 'second-equation'
    source.paragraphs[0].runs.push(copy)
    const original = structuredClone(source)
    expect(() => normalizeTextDocument(source)).toThrow(TypeError)
    expect(source).toEqual(original)
  })

  it.each(['text', 'field', 'break'])('rejects equation payload on a %s run', kind => {
    const source = inlineDocument()
    const run = source.paragraphs[0].runs[1]
    run.kind = kind
    if (kind !== 'break') run.text = 'not an equation'
    if (kind === 'field') run.field = { id: 'f', type: 'slidenum' }
    expect(() => normalizeTextDocument(source)).toThrow(TypeError)
  })

  it('rejects an equation run with dummy text or missing/unsupported math payload', () => {
    for (const mutate of [
      run => { run.text = '' },
      run => { delete run.ommlDocument },
      run => { run.ommlDocument.root.type = 'unsupported' },
    ]) {
      const source = inlineDocument()
      mutate(source.paragraphs[0].runs[1])
      expect(() => normalizeTextDocument(source)).toThrow(TypeError)
    }
  })
})
