// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { projectHyperlinks } from './hyperlink-source-fixture.js'
import { fieldPart } from './field-fixtures.js'
import { semanticTextToTipTap, semanticTextFromTipTap } from '../../client/src/utils/pptx-semantic-text-bridge.js'
const require = createRequire(import.meta.url)
const { assertCanonicalTextEdit } = require('../../shared/src/pptx-text-operations')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
function target(presentation) {
  const element = presentation.slides[0].elements.find((e) => {
    const definition = presentation.pptxSemantic.definitions[presentation.pptxSemantic.instances[e.pptxInstanceId].definitionId]
    return definition.source.partUri === fieldPart
  })
  const instance = presentation.pptxSemantic.instances[element.pptxInstanceId]
  const definition = presentation.pptxSemantic.definitions[instance.definitionId]
  return { element, instance, definition, text: definition.content.textDocument }
}
describe('source hyperlink canonical TipTap bridge', () => {
  it('preserves click/hover declarations and immutable identities on a genuine source no-op roundtrip', async () => {
    const { presentation } = await projectHyperlinks(), { text } = target(presentation)
    expect(semanticTextFromTipTap(semanticTextToTipTap(text))).toEqual(text)
  })
  it('keeps source hyperlink references on authored inline style segments and rejects foreign aliases', async () => {
    const { presentation } = await projectHyperlinks(), { text, element, instance } = target(presentation)
    const json = semanticTextToTipTap(text), content = json.content[0].content
    const index = content.findIndex((node) => node.marks?.some((mark) => mark.attrs?.pptxRun?.run.hyperlinks))
    const node = content[index], right = structuredClone(node)
    right.text = node.text.slice(6)
    right.marks.push({ type: 'bold' })
    content.splice(index, 1, { ...node, text: node.text.slice(0, 6) }, right)
    const edited = semanticTextFromTipTap(json)
    const linked = edited.paragraphs.flatMap((p) => p.runs).filter((run) => run.hyperlinks)
    expect(linked).toHaveLength(2)
    expect(linked[1].componentId).toBe(`${linked[0].componentId}~1`)
    expect(linked[1].hyperlinks).toEqual(linked[0].hyperlinks)
    expect(() => assertCanonicalTextEdit(presentation.pptxSemantic, presentation.slides[0], element, edited)).not.toThrow()
    const next = structuredClone(presentation)
    next.pptxSemantic.instances[instance.id].overrides.components = {
      ...instance.overrides.components, [text.componentId]: { textDocument: edited },
    }
    expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(next))).pptxSemantic.definitions)
      .toEqual(presentation.pptxSemantic.definitions)
    const foreign = structuredClone(edited)
    foreign.paragraphs[0].runs.find((run) => run.hyperlinks).componentId = 'foreign-authored-run'
    expect(() => assertCanonicalTextEdit(presentation.pptxSemantic, presentation.slides[0], element, foreign)).toThrow(/source hyperlink/)
  })
  it('reopens and splits an already split linked segment with flat source-owned identities', async () => {
    const { presentation } = await projectHyperlinks(), { text, element, instance } = target(presentation)
    const json = semanticTextToTipTap(text), content = json.content[0].content
    const index = content.findIndex((node) => node.marks?.some((mark) => mark.attrs?.pptxRun?.run.hyperlinks))
    const original = content[index], right = structuredClone(original)
    right.text = original.text.slice(6)
    right.marks.push({ type: 'bold' })
    content.splice(index, 1, { ...original, text: original.text.slice(0, 6) }, right)
    const first = semanticTextFromTipTap(json)
    const reopened = semanticTextToTipTap(JSON.parse(JSON.stringify(first)))
    const segment = reopened.content[0].content.findIndex((node) => node.marks?.some((mark) => mark.attrs?.pptxRun?.run.componentId.endsWith('~1')))
    const split = reopened.content[0].content[segment], tail = structuredClone(split)
    tail.text = split.text.slice(2)
    tail.marks.push({ type: 'italic' })
    reopened.content[0].content.splice(segment, 1, { ...split, text: split.text.slice(0, 2) }, tail)
    const edited = semanticTextFromTipTap(reopened)
    const linked = edited.paragraphs.flatMap((paragraph) => paragraph.runs).filter((run) => run.hyperlinks)
    expect(linked.map((run) => run.componentId)).toEqual([linked[0].componentId, `${linked[0].componentId}~1`, `${linked[0].componentId}~2`])
    expect(linked.map((run) => run.text).join('')).toBe('Linked source')
    expect(linked[2].properties).toMatchObject({ bold: true, italic: true })
    assertCanonicalTextEdit(presentation.pptxSemantic, presentation.slides[0], element, edited)
    const next = structuredClone(presentation)
    next.pptxSemantic.instances[instance.id].overrides.components = { [text.componentId]: { textDocument: edited } }
    expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(next))).pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
  })
  it('reserves existing IDs in later paragraphs and does not conflate unrelated authored suffixes', async () => {
    const { presentation } = await projectHyperlinks(), { text } = target(presentation)
    const multi = structuredClone(text)
    const linkedRun = multi.paragraphs[0].runs.find((r) => r.hyperlinks)
    const rootId = linkedRun.componentId
    // Add a second paragraph with an existing run that has ID `${rootId}~1` and an unrelated authored run
    multi.paragraphs.push({
      componentId: `${multi.componentId}~p2`,
      runs: [
        { componentId: `${rootId}~1`, kind: 'text', text: 'reserved-in-p2', properties: {} },
        { componentId: `${multi.componentId}~authored~1`, kind: 'text', text: 'unrelated', properties: {} },
      ],
    })
    const json = semanticTextToTipTap(multi)
    // Split the linked run in paragraph 0
    const content0 = json.content[0].content
    const index = content0.findIndex((node) => node.marks?.some((m) => m.attrs?.pptxRun?.run.hyperlinks))
    const original = content0[index], right = structuredClone(original)
    right.text = original.text.slice(6)
    right.marks.push({ type: 'bold' })
    content0.splice(index, 1, { ...original, text: original.text.slice(0, 6) }, right)
    const edited = semanticTextFromTipTap(json)
    const linked = edited.paragraphs[0].runs.filter((r) => r.hyperlinks)
    // Because `${rootId}~1` was reserved in p2, the split run should be allocated `${rootId}~2`
    expect(linked.map((r) => r.componentId)).toEqual([rootId, `${rootId}~2`])
    expect(edited.paragraphs[1].runs[0].componentId).toBe(`${rootId}~1`)
    expect(edited.paragraphs[1].runs[1].componentId).toBe(`${multi.componentId}~authored~1`)
  })
})
