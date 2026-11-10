import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PropertiesPanel from './PropertiesPanel'
import { useEditorElementController } from '../hooks/editor-controller/use-editor-element-controller'
import { geometryProjectionFixture } from '../../../tests/pptx-semantic/geometry-projection-fixture.js'
import { geometryStyleFixture } from '../../../tests/pptx-semantic/geometry-style-fixture.js'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import inheritance from 'revealjs-shared/src/pptx-inheritance-operations.js'
import { materializeTextDocument } from 'revealjs-shared/src/pptx-text-materialization.js'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function fixture() {
  const presentation = { ...geometryProjectionFixture(), pptxSemantic: geometryStyleFixture() }
  const definition = presentation.pptxSemantic.definitions.definition
  definition.components.push(...['body', 'paragraph', 'label', 'suffix'].map((id, index) => ({
    id, kind: index < 2 ? 'paragraph' : 'run',
    locator: { path: [0, 0, 5 + index], preconditionHash: definition.source.preconditionHash },
  })))
  definition.content.textDocument = {
    schemaVersion: 1, componentId: 'body', body: {},
    paragraphs: [{ componentId: 'paragraph', properties: {}, defaultRunProperties: {}, runs: [
      { componentId: 'label', kind: 'text', text: 'Source label', properties: { bold: true } },
      { componentId: 'suffix', kind: 'text', text: ' suffix', properties: { italic: true } },
    ] }],
  }
  presentation.slides[0].title = 'Opening'
  presentation.slides[1].title = 'Closing'
  return semantic.normalizeSemanticPresentation(presentation)
}

function mount(initial = fixture()) {
  const update = vi.fn(), commit = vi.fn()
  let latest = initial
  function Inspector() {
    const [presentation, setPresentation] = useState(initial)
    latest = presentation
    const slide = presentation.slides[0]
    const controller = useEditorElementController({
      presentation, activeSlide: slide, editingElementIdRef: { current: null },
      setPresentation: (next) => { commit(next); setPresentation(next) },
      mapActive: (previous, transform) => ({
        ...previous, slides: [transform(previous.slides[0]), ...previous.slides.slice(1)],
      }),
    })
    return <PropertiesPanel presentation={presentation} slide={slide}
      selectedElement={slide.elements[0]} selectedElementIds={[slide.elements[0].id]}
      onUpdateElement={(id, patch) => { update(id, patch); controller.updateElement(id, patch) }} />
  }
  const view = render(<Inspector />)
  return { ...view, update, commit, initial, latest: () => latest }
}
const editText = (value) => fireEvent.change(screen.getByRole('textbox', {
  name: 'PPTX text paragraph 1 run 1',
}), { target: { value } })
const label = (presentation, instanceId) => materializeTextDocument(
  presentation.pptxSemantic, instanceId
).paragraphs[0].runs[0].text

describe('PropertiesPanel source-bound inheritance text integration', () => {
  it('defaults to the selected occurrence without preview and publishes one source-bound update', () => {
    const preview = vi.spyOn(inheritance, 'previewInheritanceEdit')
    const view = mount()
    expect(screen.getByRole('region', { name: 'Source-bound PPTX text' }).textContent)
      .toContain('Scope: Selected occurrence')
    editText('Only Opening')
    expect(view.update).not.toHaveBeenCalled()
    expect(preview).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Apply to all linked occurrences' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Apply to selected occurrence' }))

    expect(preview).not.toHaveBeenCalled()
    expect(view.update).toHaveBeenCalledTimes(1)
    expect(view.commit).toHaveBeenCalledTimes(1)
    const [id, patch] = view.update.mock.calls[0]
    expect(id).toBe('i1')
    expect(Object.keys(patch)).toEqual(['pptxProjectionOperation'])
    expect(patch.pptxProjectionOperation).toMatchObject({
      type: 'inheritance.edit', instanceId: 'i1', scope: 'selected',
      command: { type: 'text-document' },
    })
    expect(patch.pptxProjectionOperation).not.toHaveProperty('preview')
    expect(label(view.latest(), 'i1')).toBe('Only Opening')
    expect(label(view.latest(), 'i2')).toBe('Source label')
    expect(view.latest().pptxSemantic.instances.i2).toEqual(view.initial.pptxSemantic.instances.i2)
    expect(view.latest().pptxSemantic.definitions).toEqual(view.initial.pptxSemantic.definitions)
    expect(materializeTextDocument(view.latest().pptxSemantic, 'i1').paragraphs[0].runs[1])
      .toEqual({ componentId: 'suffix', kind: 'text', text: ' suffix', properties: { italic: true } })
  })

  it('previews actual impacted slides only on explicit action, then submits that exact preview once', () => {
    const preview = vi.spyOn(inheritance, 'previewInheritanceEdit')
    const view = mount()
    editText('Linked edit')
    expect(preview).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Preview edit all occurrences' }))
    expect(preview).toHaveBeenCalledTimes(1)
    expect(view.update).not.toHaveBeenCalled()
    expect(view.commit).not.toHaveBeenCalled()
    const inspected = preview.mock.results[0].value
    const intent = preview.mock.calls[0][1]
    expect(intent.scope).toBe('all')
    const impacted = screen.getByRole('list', { name: 'Impacted slides' })
    expect(within(impacted).getAllByRole('listitem').map((item) => item.textContent))
      .toEqual(['Opening (s1)', 'Closing (s2)'])

    fireEvent.click(screen.getByRole('button', { name: 'Apply to all linked occurrences' }))

    expect(view.update).toHaveBeenCalledExactlyOnceWith('i1', {
      pptxProjectionOperation: { ...intent, preview: inspected },
    })
    expect(view.update.mock.calls[0][1].pptxProjectionOperation.preview).toBe(inspected)
    expect(preview).toHaveBeenCalledTimes(1)
    expect(view.commit).toHaveBeenCalledTimes(1)
    expect(label(view.latest(), 'i1')).toBe('Linked edit')
    expect(label(view.latest(), 'i2')).toBe('Linked edit')
  })

  it('discards a preview after typing or canceling and keeps selected scope available', () => {
    const preview = vi.spyOn(inheritance, 'previewInheritanceEdit')
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Preview edit all occurrences' }))
    editText('New draft')
    expect(screen.queryByRole('region', { name: 'Edit all impact preview' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview edit all occurrences' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit all' }))
    expect(view.update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply to selected occurrence' }))
    expect(preview).toHaveBeenCalledTimes(2)
    expect(view.commit).toHaveBeenCalledTimes(1)
    expect(view.update.mock.calls[0][1].pptxProjectionOperation.scope).toBe('selected')
    expect(label(view.latest(), 'i2')).toBe('Source label')
  })

  it('shows locked impacted slides and blocks all without blocking the selected occurrence', () => {
    const initial = fixture()
    initial.slides[1].locked = true
    const view = mount(initial)
    editText('Unlocked selected')
    fireEvent.click(screen.getByRole('button', { name: 'Preview edit all occurrences' }))
    expect(screen.getByRole('alert').textContent).toMatch(/linked occurrence is locked/i)
    expect(screen.getByRole('button', { name: 'Apply to all linked occurrences' }).disabled).toBe(true)
    expect(view.update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply to selected occurrence' }))
    expect(view.commit).toHaveBeenCalledTimes(1)
    expect(label(view.latest(), 'i1')).toBe('Unlocked selected')
    expect(label(view.latest(), 'i2')).toBe('Source label')
  })

  it('discloses preview failures without publishing any update', () => {
    const view = mount()
    const apply = vi.spyOn(inheritance, 'previewInheritanceEdit')
      .mockImplementation(() => { throw new TypeError('Inherited edit missing projected occurrence') })
    fireEvent.click(screen.getByRole('button', { name: 'Preview edit all occurrences' }))
    expect(screen.getByRole('alert').textContent).toMatch(/missing projected occurrence/)
    expect(view.update).not.toHaveBeenCalled()
    expect(view.commit).not.toHaveBeenCalled()
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('surfaces a rejected all-occurrence submission without retrying or replacing its preview', () => {
    const initial = fixture()
    const onUpdate = vi.fn(() => { throw new TypeError('Inherited edit missing or stale impact preview') })
    const preview = vi.spyOn(inheritance, 'previewInheritanceEdit')
    render(<PropertiesPanel presentation={initial} slide={initial.slides[0]}
      selectedElement={initial.slides[0].elements[0]} selectedElementIds={['i1']}
      onUpdateElement={onUpdate} />)
    editText('Rejected edit')
    fireEvent.click(screen.getByRole('button', { name: 'Preview edit all occurrences' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply to all linked occurrences' }))
    expect(screen.getByRole('alert').textContent).toMatch(/stale impact preview/)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(preview).toHaveBeenCalledTimes(1)
    expect(onUpdate.mock.calls[0][1].pptxProjectionOperation.preview).toBe(preview.mock.results[0].value)
    expect(screen.queryByRole('region', { name: 'Edit all impact preview' })).toBeNull()
    expect(label(initial, 'i1')).toBe('Source label')
    expect(label(initial, 'i2')).toBe('Source label')
  })
})
