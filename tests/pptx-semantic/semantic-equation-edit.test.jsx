import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { arg, doc, node, options } from './omml-rendering-fixtures.js'
import { familyDocumentsFixture } from './family-documents-fixture.js'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations.js'
import { applyPresentationProjectionOperation } from '../../shared/src/pptx-projection-operation.js'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation.js'

const require = createRequire(import.meta.url)
const { applyOmmlOperations, normalizeOmmlDocument } = {
  ...require('../../shared/src/pptx-omml-operations.js'),
  ...require('../../shared/src/pptx-omml-document.js'),
}
const { createOmmlPropertyCommand, createOmmlMatrixCommand } =
  require('../../shared/src/pptx-omml-operations-structure.js')
const { renderOmmlDocument } = require('../../shared/src/pptx-omml-renderer.js')
function find(nodeValue, type) {
  if (nodeValue.type === type) return nodeValue
  for (const child of nodeValue.children) {
    const found = find(child, type)
    if (found) return found
  }
  return null
}

describe('semantic equation edit acceptance', () => {
  it('persists fraction, matrix and script AST edits through normalization and reload', () => {
    const input = doc(
      node('f', [arg('num', 'a'), arg('den', 'b')]),
      node('m', [
        node('mr', [arg('e', 'x'), arg('e', 'y')]),
        node('mr', [arg('e', 'z'), arg('e', 'w')]),
      ]),
      node('sSubSup', [arg('e', 'q'), arg('sub', 'i'), arg('sup', '2')])
    )
    const fractionNumerator = find(input.root.children[0], 't')
    const matrixEntry = find(input.root.children[1].children[1], 't')
    const scriptBase = find(input.root.children[2], 't')
    const edited = applyOmmlOperations(input, [
      { type: 'setText', componentId: fractionNumerator.componentId, text: 'alpha' },
      { type: 'setText', componentId: matrixEntry.componentId, text: 'w_2' },
      { type: 'setText', componentId: scriptBase.componentId, text: 'r' },
    ])
    const reopened = normalizeOmmlDocument(JSON.parse(JSON.stringify(edited)))
    expect(reopened.root.children.map(({ type }) => type)).toEqual(['f', 'm', 'sSubSup'])
    expect(find(reopened.root.children[0], 't').text).toBe('alpha')
    expect(find(reopened.root.children[1].children[1], 't').text).toBe('w_2')
    expect(find(reopened.root.children[2], 't').text).toBe('r')
    expect(find(input.root.children[0], 't').text).toBe('a')
  })

  it('rejects malformed AST and invalid edits without mutating the source equation', () => {
    const input = doc(node('f', [arg('num', 'a'), arg('den', 'b')]))
    const before = JSON.stringify(input)
    const malformed = structuredClone(input)
    malformed.root.children[0].children[0].type = 'unsupported'
    expect(() => normalizeOmmlDocument(malformed)).toThrow(TypeError)
    expect(JSON.stringify(input)).toBe(before)
    expect(() => applyOmmlOperations(input, [
      { type: 'setText', componentId: input.root.componentId, text: 'flattened fraction' },
      { type: 'remove', componentId: 'missing' },
    ])).toThrow(TypeError)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('persists an imported equation edit through occurrence operation replay and presentation reload', async () => {
    const document = (await familyDocumentsFixture()).equation
    document.instances.sibling = { ...document.instances.occurrence, id: 'sibling' }
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: ['occurrence', 'sibling'].map((id) => ({ id, type: 'latex', pptxInstanceId: id })),
      }],
      pptxSemantic: document,
    })
    const original = JSON.stringify(input)
    const element = familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0])
    const target = find(element.ommlDocument.root, 't')
    const sourceText = target.text
    const saved = applyPresentationProjectionOperation(input, {
      type: 'omml.edit',
      instanceId: 'occurrence',
      componentId: element.ommlDocument.root.componentId,
      command: { type: 'setText', componentId: target.componentId, text: 'persisted equation edit' },
    })
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(saved)))
    const changed = familyCompatibilityElement(reopened.pptxSemantic, reopened.slides[0].elements[0])
    const sibling = familyCompatibilityElement(reopened.pptxSemantic, reopened.slides[0].elements[1])
    expect(find(changed.ommlDocument.root, 't').text).toBe('persisted equation edit')
    expect(find(sibling.ommlDocument.root, 't').text).toBe(sourceText)
    expect(reopened.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(JSON.stringify(input)).toBe(original)
    expect(reopened.pptxSemantic.instances.occurrence.overrides.components[
      element.ommlDocument.root.componentId
    ].familyOperations.commands).toHaveLength(1)
  })

  it('retains fraction presentation, matrix dimensions and script slot edits through structural commands and render parity', () => {
    const input = doc(
      node('f', [arg('num', '1'), arg('den', '2')]),
      node('m', [
        node('mr', [arg('e', 'a'), arg('e', 'b')]),
        node('mr', [arg('e', 'c'), arg('e', 'd')]),
      ]),
      node('sSubSup', [arg('e', 'x'), arg('sub', '1'), arg('sup', '2')])
    )
    const fractionNode = input.root.children[0]
    const matrixNode = input.root.children[1]
    const fCmd = createOmmlPropertyCommand(input, fractionNode.componentId, 'type', 'skw', 'test-token-1')
    const mRowCmd = createOmmlMatrixCommand(input, matrixNode.componentId,
      { axis: 'row', action: 'insert', index: 2 }, 'test-token-2')
    const step1 = applyOmmlOperations(input, [fCmd, mRowCmd])
    const mColCmd = createOmmlMatrixCommand(step1, matrixNode.componentId,
      { axis: 'column', action: 'insert', index: 2 }, 'test-token-3')
    const step2 = applyOmmlOperations(step1, [mColCmd])
    const reopened = normalizeOmmlDocument(JSON.parse(JSON.stringify(step2)))
    const reopenedFraction = reopened.root.children[0]
    const reopenedMatrix = reopened.root.children[1]
    const fPr = reopenedFraction.children.find((c) => c.type === 'fPr')
    expect(fPr.children.find((c) => c.type === 'type').attributes[0].value).toBe('skw')
    const matrixRows = reopenedMatrix.children.filter((c) => c.type === 'mr')
    expect(matrixRows).toHaveLength(3)
    expect(matrixRows[0].children).toHaveLength(3)
    expect(matrixRows[1].children).toHaveLength(3)
    expect(matrixRows[2].children).toHaveLength(3)
    const rendered = renderOmmlDocument(reopened, options)
    expect(rendered.svg).toContain('data-component-id=')
    expect(rendered.svg).not.toMatch(/<image|foreignObject/)
    expect(rendered.svg).not.toContain('\\frac')
    expect(rendered.layout.children).toHaveLength(3)
  })

  it('rejects ragged matrix edits, invalid axes and dimension underflows atomically', () => {
    const input = doc(node('m', [
      node('mr', [arg('e', '1'), arg('e', '2')]),
    ]))
    const before = JSON.stringify(input)
    const matrixNode = input.root.children[0]
    expect(() => createOmmlMatrixCommand(input, matrixNode.componentId,
      { axis: 'row', action: 'remove', index: 0 }, 'test-tok')).toThrow(/dimension/)
    expect(() => createOmmlMatrixCommand(input, matrixNode.componentId,
      { axis: 'column', action: 'remove', index: 5 }, 'test-tok')).toThrow(/dimension/)
    expect(() => createOmmlMatrixCommand(input, matrixNode.componentId,
      { axis: 'diagonal', action: 'insert', index: 0 }, 'test-tok')).toThrow(/matrix request/)
    expect(JSON.stringify(input)).toBe(before)
  })
})

