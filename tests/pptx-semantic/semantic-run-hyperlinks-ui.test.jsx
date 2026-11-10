// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import NativeRunHyperlinkControls from '../../client/src/components/properties/native-run-hyperlink-controls.jsx'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller.js'
import { projectHyperlinks } from './hyperlink-source-fixture.js'
import { fieldPart } from './field-fixtures.js'
const require = createRequire(import.meta.url)
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
let current
const mapActive = (deck, fn) => ({ ...deck, slides: deck.slides.map((s, i) => i === 0 ? fn(s) : s) })
function Harness({ initial }) {
  const [presentation, setPresentation] = useState(initial), editingElementIdRef = useRef(null)
  const slide = presentation.slides[0]
  const element = slide.elements.find((e) => {
    const definition = presentation.pptxSemantic.definitions[presentation.pptxSemantic.instances[e.pptxInstanceId]?.definitionId]
    return definition?.source.partUri === fieldPart && (definition.content.textDocument || definition.content.tableDocument)
  })
  const { updateElement } = useEditorElementController({ presentation, setPresentation,
    activeSlide: slide, mapActive, editingElementIdRef })
  useLayoutEffect(() => { current = { presentation, element } })
  return <NativeRunHyperlinkControls {...{ presentation, element, slide }}
    onUpdate={(patch) => updateElement(element.id, patch)} />
}
afterEach(cleanup)
function effectiveRun(presentation, id) {
  const instance = presentation.pptxSemantic.instances[id], definition = presentation.pptxSemantic.definitions[instance.definitionId]
  const { materializeTextDocument } = require('../../shared/src/pptx-text-materialization')
  const { materializeFamilyDocument } = require('../../shared/src/pptx-family-operations')
  const text = definition.content.textDocument ? materializeTextDocument(presentation.pptxSemantic, id)
    : materializeFamilyDocument(definition, instance).rows[0].cells[0].textDocument
  return text.paragraphs.flatMap((p) => p.runs).find((run) => run.hyperlinks)
}
describe('native source run hyperlink action inspector', () => {
  it.each([false, true])('edits click and hover through the genuine occurrence transaction (table=%s)', async (table) => {
    const { presentation: initial } = await projectHyperlinks({ table }), before = structuredClone(initial)
    render(<Harness initial={initial} />)
    const id = current.element.pptxInstanceId
    expect(screen.getByLabelText('Action URL').value).toBe('https://example.test/source?x=1&y=2')
    expect(screen.queryByLabelText('Transparent hotspot')).toBeNull()
    expect(screen.queryByLabelText('Initial runtime visibility')).toBeNull()
    fireEvent.change(screen.getByLabelText('Action URL'), { target: { value: 'https://edited.test/run' } })
    fireEvent.click(screen.getByText('Apply run hyperlink'))
    expect(effectiveRun(current.presentation, id).hyperlinks.click.action.url).toBe('https://edited.test/run')
    fireEvent.change(screen.getByLabelText('Hyperlink trigger'), { target: { value: 'hover' } })
    expect(screen.getByLabelText('Run action').value).toBe('slide')
    expect(screen.getByLabelText('Destination slide').value).toBe(initial.slides[1].id)
    fireEvent.change(screen.getByLabelText('Run action'), { target: { value: 'next' } })
    fireEvent.click(screen.getByText('Apply run hyperlink'))
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(current.presentation)))
    const run = effectiveRun(reopened, id)
    expect(run.hyperlinks.hover.action).toEqual({ kind: 'next' })
    expect(run.hyperlinks.hover.targetPartUri).toBe('ppt/slides/slide3.xml')
    expect(run.hyperlinks.click.declarations).toEqual(effectiveRun(before, id).hyperlinks.click.declarations)
    expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(() => assertSemanticBaseline(before, reopened)).not.toThrow()
    for (const [otherId, instance] of Object.entries(before.pptxSemantic.instances)) {
      if (otherId === id) continue
      expect(current.presentation.pptxSemantic.instances[otherId]).toEqual(instance)
      expect(reopened.pptxSemantic.instances[otherId]).toEqual(JSON.parse(JSON.stringify(instance)))
    }
    expect(current.element).not.toHaveProperty('action')
    fireEvent.change(screen.getByLabelText('Hyperlink trigger'), { target: { value: 'click' } })
    fireEvent.change(screen.getByLabelText('Run action'), { target: { value: 'none' } })
    fireEvent.click(screen.getByText('Apply run hyperlink'))
    const cleared = normalizeSemanticPresentation(JSON.parse(JSON.stringify(current.presentation)))
    expect(effectiveRun(cleared, id).hyperlinks.click.action).toBeNull()
    expect(cleared.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(() => assertSemanticBaseline(before, cleared)).not.toThrow()
  })
  it('rejects unsafe input without a canonical write and honors locked occurrences', async () => {
    const { presentation } = await projectHyperlinks(), before = structuredClone(presentation)
    render(<Harness initial={presentation} />)
    fireEvent.change(screen.getByLabelText('Action URL'), { target: { value: 'javascript:bad()' } })
    fireEvent.click(screen.getByText('Apply run hyperlink'))
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(current.presentation).toEqual(before)
    cleanup()
    const locked = structuredClone(before)
    locked.slides[0].locked = true
    render(<Harness initial={locked} />)
    expect(screen.getByText('Apply run hyperlink').closest('fieldset').disabled).toBe(true)
  })
})
