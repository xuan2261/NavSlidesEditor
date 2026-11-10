// @vitest-environment node
import { expect } from 'vitest'
import { commitSemanticText, resolveSemanticText } from '../../client/src/utils/pptx-semantic-text-bridge.js'
import { copy, native, proofSuite, require } from './semantic-operation-proof-helpers.js'
const { editRunHyperlink } = require('../../shared/src/pptx-text-hyperlinks')
const proof = proofSuite('feature-fixtures.js')
const mapSlides = (deck, callback) => ({ ...deck, slides: deck.slides.map(callback) })
function commit(c, change) {
  const document = copy(resolveSemanticText(c.presentation, c.element).document)
  change(document)
  return commitSemanticText(c.presentation, c.element, document, '', mapSlides)
}
const text = (presentation, c) => resolveSemanticText(presentation, c.element).document

proof('text.content', native('2'), c => commit(c, d => { d.paragraphs[0].runs[0].text = ' Edited α & β ' }), (p, c) => {
  const result = text(p, c), source = c.definition.content.textDocument
  expect(result.paragraphs[0].runs[0].text).toBe(' Edited α & β ')
  expect(result.paragraphs[0].runs[1]).toEqual(source.paragraphs[0].runs[1])
  expect(result.body).toEqual(source.body)
}, c => commit(c, d => { d.componentId = 'foreign-body' }))

proof('text.run-style', native('2'), c => commit(c, d => {
  Object.assign(d.paragraphs[0].runs[0].properties, { fontSizePt: 31, bold: true, color: { kind: 'srgb', value: '2468AC' } })
}), (p, c) => {
  expect(text(p, c).paragraphs[0].runs[0].properties).toMatchObject({ fontSizePt: 31, bold: true, color: { kind: 'srgb', value: '2468AC' } })
  expect(text(p, c).paragraphs[0].runs[1]).toEqual(c.definition.content.textDocument.paragraphs[0].runs[1])
}, c => commit(c, d => { d.paragraphs[0].runs[0].properties.fontSizePt = -1 }))

proof('text.paragraph-layout', native('2'), c => commit(c, d => {
  d.paragraphs[0].properties = { ...d.paragraphs[0].properties, alignment: 'r', indentEmu: -12700,
    lineSpacing: { unit: 'points', value: 18 }, spaceAfter: { unit: 'points', value: 4 } }
}), (p, c) => {
  expect(text(p, c).paragraphs[0].properties).toMatchObject({ alignment: 'r', indentEmu: -12700,
    lineSpacing: { unit: 'points', value: 18 }, spaceAfter: { unit: 'points', value: 4 } })
  expect(text(p, c).paragraphs[0].runs).toEqual(c.definition.content.textDocument.paragraphs[0].runs)
}, c => commit(c, d => { d.paragraphs[0].properties = { alignment: 'invalid' } }))

proof('text.autofit', native('2'), c => commit(c, d => {
  d.body = { ...d.body, autofit: { mode: 'normal', fontScale: 75000, lineSpaceReduction: 10000 } }
}), (p, c) => {
  expect(text(p, c).body.autofit).toEqual({ mode: 'normal', fontScale: 75000, lineSpaceReduction: 10000 })
  expect(text(p, c).paragraphs).toEqual(c.definition.content.textDocument.paragraphs)
}, c => commit(c, d => { d.body = { ...d.body, autofit: { mode: 'browser-fit' } } }))

proof('action.hyperlink', native('3'), c => {
  const document = resolveSemanticText(c.presentation, c.element).document
  const run = document.paragraphs.flatMap(p => p.runs).find(r => r.hyperlinks?.click?.action?.kind === 'url')
  const next = editRunHyperlink(document, run.componentId, 'click', { kind: 'url', url: 'https://example.org/edited' })
  return commitSemanticText(c.presentation, c.element, next, '', mapSlides)
}, (p, c) => {
  const source = c.definition.content.textDocument
  const before = source.paragraphs[0].runs[0].hyperlinks.click
  const result = text(p, c).paragraphs[0].runs[0].hyperlinks.click
  expect(result.action).toEqual({ kind: 'url', url: 'https://example.org/edited' })
  expect({ ...result, action: before.action }).toEqual(before)
  expect(text(p, c).paragraphs[0].runs[1]).toEqual(source.paragraphs[0].runs[1])
}, c => {
  const document = resolveSemanticText(c.presentation, c.element).document
  editRunHyperlink(document, document.paragraphs[0].runs[0].componentId, 'click', { kind: 'url', url: 'javascript:alert(1)' })
})
