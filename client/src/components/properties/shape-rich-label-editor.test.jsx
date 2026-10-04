import React, { useRef, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ShapeProperties from './shape-properties'
import { ShapeRenderer } from '../canvas/element-renderers/shape-element-renderer'
import { useSlideOperations } from '../../hooks/use-slide-operations'

const richShape = (id = 'a') => ({
  id,
  type: 'shape',
  shape: 'rect',
  width: 300,
  height: 120,
  text: 'Original',
  textHtml:
    '<p style="color:#123456;font-size:24px;text-align:right;line-height:1.5"><span style="font-family:Arial;font-weight:600"><strong><em><u><s>Original</s></u></em></strong></span></p><p><mark data-color="#ffff00">Highlight</mark> <a href="https://example.com">Link</a> <code>Code</code> <span data-math-latex="x^2" data-math-display="false"></span></p><table><tbody><tr><th><p>Head</p></th><td><p>Cell</p></td></tr></tbody></table><img src="https://example.com/image.png" alt="Diagram">',
  _pptxImportMeta: {
    fitFontSizePx: 12,
    sourceFontSizePx: 24,
    textLength: 8,
    wrapMode: 'wrap',
    insets: { left: 4 },
  },
})

function mountShapes(initial = [richShape()]) {
  let controls
  function Harness() {
    const [presentation, setPresentation] = useState({
      slides: [{ id: 'slide', elements: initial }],
    })
    const [ids, select] = useState([initial[0].id])
    const indexRef = useRef(0)
    const selectionRef = useRef(ids)
    selectionRef.current = ids
    const editingRef = useRef(null)
    const operations = useSlideOperations({
      presentation,
      setPresentation,
      currentSlideIndexRef: indexRef,
      selectedElementIdsRef: selectionRef,
      editingElementIdRef: editingRef,
    })
    const elements = presentation.slides[0].elements
    const element = elements.find((item) => item.id === ids.at(-1))
    const writes = useRef([])
    controls = { elements, select, setPresentation, writes: writes.current }
    return (
      <>
        <ShapeProperties
          element={element}
          elements={elements}
          selectedElementIds={ids}
          onUpdate={(patch) => {
            writes.current.push(patch)
            operations.updateElements([{ id: element.id, ...patch }])
          }}
        />
        <div data-testid="rendered-label">
          <ShapeRenderer element={element} />
        </div>
      </>
    )
  }
  const mounted = render(<Harness />)
  return { ...mounted, state: () => controls }
}

async function getEditor() {
  let editor
  await waitFor(() => {
    editor = screen.getByRole('textbox', { name: 'Shape rich label' }).editor
    expect(editor?.isDestroyed).toBe(false)
  })
  return editor
}

function replaceOriginal(editor) {
  act(() => editor.view.dispatch(editor.state.tr.insertText('Revised', 1, 9)))
}

describe('shape rich label document authoring', () => {
  it('persists an edited document without losing imported marks, blocks, or rendered authority', async () => {
    const app = mountShapes()
    const editor = await getEditor()
    expect(app.state().writes).toEqual([])
    replaceOriginal(editor)
    const saved = app.state().elements[0]
    const document = new DOMParser().parseFromString(saved.textHtml, 'text/html')
    expect(saved.text).toContain('Revised')
    expect(saved.text).not.toContain('Original')
    for (const mark of ['strong', 'em', 'u', 's']) {
      expect(document.querySelector(mark)?.textContent).toBe('Revised')
    }
    const span = document.querySelector('p span')
    expect(span.style.color).toBe('rgb(18, 52, 86)')
    expect(span.style.fontSize).toBe('24px')
    expect(span.style.fontFamily).toBe('Arial')
    expect(span.style.fontWeight).toBe('600')
    expect(document.querySelector('p').style.textAlign).toBe('right')
    expect(document.querySelector('p').style.lineHeight).toBe('1.5')
    expect(document.querySelector('mark').textContent).toBe('Highlight')
    expect(document.querySelector('a').getAttribute('href')).toBe('https://example.com')
    expect(document.querySelector('code').textContent).toBe('Code')
    expect(document.querySelector('[data-math-latex]').getAttribute('data-math-latex')).toBe('x^2')
    expect(document.querySelector('th').textContent).toBe('Head')
    expect(document.querySelector('td').textContent).toBe('Cell')
    expect(document.querySelector('img').getAttribute('alt')).toBe('Diagram')
    expect(screen.getByTestId('rendered-label').textContent).toContain('Revised')
    expect(saved._pptxImportMeta).toEqual({ wrapMode: 'wrap', insets: { left: 4 } })
  })

  it('clears the rendered label and reloads an empty rich document, not stale plain text', async () => {
    const app = mountShapes()
    const editor = await getEditor()
    act(() => editor.commands.clearContent())
    const saved = app.state().elements[0]
    expect(saved.text).toBe('')
    expect(screen.getByTestId('rendered-label').textContent).toBe('')
    expect(saved.textHtml).toBe('<p></p>')
    app.unmount()
    const reloaded = mountShapes([saved])
    expect((await getEditor()).getText()).toBe('')
    expect(screen.getByTestId('rendered-label').textContent).toBe('')
    expect(reloaded.state().writes).toEqual([])
  })

  it('synchronizes external undo/redo without writes and preserves selection/composition on own echoes', async () => {
    const original = richShape()
    const app = mountShapes([original])
    const editor = await getEditor()
    act(() => editor.commands.setTextSelection(4))
    fireEvent.compositionStart(editor.view.dom)
    act(() => editor.view.dispatch(editor.state.tr.insertText('X')))
    expect(editor.state.selection.from).toBe(5)
    expect(editor.view.composing).toBe(true)
    fireEvent.compositionEnd(editor.view.dom)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    const baseline = app.state().writes.length
    expect(app.state().writes.map((patch) => patch.text.split('\n')[0])).toEqual(['OriXginal'])
    const edited = app.state().elements[0]
    act(() => app.state().setPresentation({ slides: [{ id: 'slide', elements: [original] }] }))
    expect(editor.getText()).toContain('Original')
    expect(app.state().writes).toHaveLength(baseline)
    act(() => app.state().setPresentation({ slides: [{ id: 'slide', elements: [edited] }] }))
    expect(editor.getText()).toContain('OriXginal')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(app.state().writes).toHaveLength(baseline)
  })

  it('revokes stale editor callbacks on target switch and disables locked or multiple selections', async () => {
    const a = richShape('a')
    const b = { ...richShape('b'), textHtml: '<p>Sibling</p>', text: 'Sibling' }
    const app = mountShapes([a, b])
    const stale = await getEditor()
    act(() => app.state().select(['b']))
    const current = await getEditor()
    expect(current).not.toBe(stale)
    act(() => stale.emit('update', { editor: stale }))
    expect(app.state().elements).toEqual([a, b])
    expect(app.state().writes).toEqual([])
    act(() => app.state().select(['a', 'b']))
    expect(current.isEditable).toBe(false)
    act(() => current.view.dispatch(current.state.tr.insertText('Forbidden', 1)))
    expect(app.state().elements).toEqual([a, b])
    act(() => app.state().select(['b']))
    act(() =>
      app
        .state()
        .setPresentation({ slides: [{ id: 'slide', elements: [a, { ...b, locked: true }] }] })
    )
    expect(current.isEditable).toBe(false)
    act(() => current.view.dispatch(current.state.tr.insertText('Locked', 1)))
    expect(app.state().elements[1].text).toBe('Sibling')
    expect(app.state().writes).toEqual([])
  })

  it('preserves imported list colors, sizes, and spacing when editing a list label', async () => {
    const shape = {
      ...richShape(),
      textHtml:
        '<ul style="color:#123456;font-size:24px;line-height:1.7"><li><p>Original</p></li></ul>',
    }
    const app = mountShapes([shape])
    const editor = await getEditor()
    act(() => editor.view.dispatch(editor.state.tr.insertText('Revised', 3, 11)))
    const document = new DOMParser().parseFromString(app.state().elements[0].textHtml, 'text/html')
    expect(document.querySelector('li').style.lineHeight).toBe('1.7')
    expect(document.querySelector('li span').style.color).toBe('rgb(18, 52, 86)')
    expect(document.querySelector('li span').style.fontSize).toBe('24px')
    expect(document.querySelector('li').textContent).toBe('Revised')
    expect(screen.getByTestId('rendered-label').textContent).toBe('Revised')
  })

  it('keeps plain labels plain and leaves rich siblings untouched', () => {
    const a = { ...richShape('a'), textHtml: '', text: 'Plain' }
    const b = richShape('b')
    const app = mountShapes([a, b])
    fireEvent.change(screen.getByTestId('prop-shape-label'), { target: { value: 'Changed plain' } })
    expect(app.state().elements[0].text).toBe('Changed plain')
    expect(app.state().elements[0].textHtml).toBe('')
    expect(app.state().elements[1]).toEqual(b)
    expect(screen.queryByRole('textbox', { name: 'Shape rich label' })).toBeNull()
  })
})
