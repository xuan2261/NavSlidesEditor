import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TableRenderer } from './table-element-renderer'

const richCell = { html: '<p style="font-size:20px;color:#123456;line-height:1.4;margin-bottom:6px"><strong>Original</strong><span style="font-weight:400"> normal\u00a0text</span></p><p>Second<br>Third</p>' }
const sibling = { html: '<p><em>Untouched</em></p>' }
const initial = { id: 'table', type: 'table', data: [[richCell, sibling, '<b>literal</b>', 0, false]], headerRow: true, cellStyles: { isBold: [[true]], fontSizes: [[9]] } }
const paragraphTypography = {
  ...initial,
  data: [[{ html: '<p style="font-family:Arial;font-weight:400;line-height:1.5;margin-bottom:8px">Original</p>' }, sibling]],
  cellStyles: { fontFamilies: [['Courier New']] },
}

function mountTable(seed = initial, editing = true) {
  let state
  function Harness() {
    const [element, setElement] = useState(seed)
    const [isEditing, setEditing] = useState(editing)
    const [writes, setWrites] = useState([])
    state = { element, setElement, setEditing, writes }
    return <div>
      <TableRenderer element={element} isEditing={isEditing} onUpdateElement={(id, patch) => {
        setWrites((current) => [...current, { id, patch }])
        setElement((current) => ({ ...current, ...patch }))
      }} />
    </div>
  }
  return { ...render(<Harness />), state: () => state }
}

async function editorFor(row = 1, column = 1) {
  let editor
  await waitFor(() => {
    editor = screen.getByRole('textbox', { name: `Table rich cell row ${row} column ${column}` }).editor
    expect(editor?.isDestroyed).toBe(false)
  })
  return editor
}

function expectRunTypography(root, family, weight) {
  const text = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let runCount = 0
  while (text.nextNode()) {
    if (!text.currentNode.textContent.trim()) continue
    const inherited = (property) => {
      for (let node = text.currentNode.parentElement; node; node = node.parentElement) {
        if (node.style.getPropertyValue(property)) return node.style.getPropertyValue(property)
      }
      return ''
    }
    expect(inherited('font-family')).toBe(family)
    expect(inherited('font-weight')).toBe(weight)
    runCount += 1
  }
  expect(runCount).toBeGreaterThan(0)
}

describe('rich table document authoring', () => {
  it('renders rich styles and paragraphs while primitive HTML remains literal text', () => {
    const app = mountTable(initial, false)
    const cells = app.container.querySelectorAll('td')
    expect(cells[0].querySelector('strong').textContent).toBe('Original')
    expect(cells[0].querySelectorAll('p')).toHaveLength(2)
    expect(cells[0].querySelector('p').style.fontSize).toBe('20px')
    expect(cells[0].querySelector('p').style.lineHeight).toBe('1.4')
    expect(cells[0].querySelector('span').style.fontWeight).toBe('400')
    expect(cells[2].textContent).toBe('<b>literal</b>')
    expect(cells[2].querySelector('b')).toBeNull()
    expect([...cells].slice(3).map((cell) => cell.textContent)).toEqual(['0', 'false'])
    expect(app.state().writes).toEqual([])
  })

  it('mounts only the focused rich editor, saves real edits and reopens without losing runs', async () => {
    const app = mountTable()
    const editor = await editorFor()
    expect(app.container.querySelectorAll('.tiptap')).toHaveLength(1)
    expect(app.container.querySelectorAll('textarea')).toHaveLength(3)
    await waitFor(() => expect(document.activeElement).toBe(editor.view.dom))
    expect(app.state().writes).toEqual([])
    act(() => editor.view.dispatch(editor.state.tr.insertText('Revised', 1, 9)))
    const saved = app.state().element
    const doc = new DOMParser().parseFromString(saved.data[0][0].html, 'text/html')
    expect(doc.querySelector('strong').textContent).toBe('Revised')
    expect(doc.querySelector('p').style.lineHeight).toBe('1.4')
    expect(doc.querySelector('p').style.marginBottom).toBe('6px')
    expect(doc.querySelector('span').style.fontSize).toBe('20px')
    expect(doc.body.textContent).toContain(' normal\u00a0text')
    expect(doc.querySelectorAll('p')).toHaveLength(2)
    expect(doc.querySelector('br')).not.toBeNull()
    expect(saved.data[0][0]).not.toHaveProperty('text')
    expect(saved.data[0].slice(1)).toEqual(initial.data[0].slice(1))
    expect(app.state().writes).toHaveLength(1)
    app.unmount()
    const reopened = mountTable(saved)
    expect((await editorFor()).getText()).toContain('Revised')
    expect(reopened.state().writes).toEqual([])
  })

  it('honors the selected cell and synchronizes undo without extra writes', async () => {
    const app = mountTable(initial, false)
    fireEvent.mouseDown(app.container.querySelectorAll('td')[1])
    act(() => app.state().setEditing(true))
    const editor = await editorFor(1, 2)
    expect(app.container.querySelectorAll('.tiptap')).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(editor.view.dom))
    act(() => editor.view.dispatch(editor.state.tr.insertText('Changed', 1, 10)))
    expect(app.state().writes).toHaveLength(1)
    const edited = app.state().element
    act(() => app.state().setElement(initial))
    expect(editor.getText()).toBe('Untouched')
    act(() => app.state().setElement(edited))
    expect(editor.getText()).toBe('Changed')
    expect(app.state().writes).toHaveLength(1)
    fireEvent.mouseDown(app.container.querySelectorAll('td')[0])
    expect((await editorFor()).getText()).toContain('Original')
    expect(app.container.querySelectorAll('.tiptap')).toHaveLength(1)
  })

  it('keeps paragraph family and explicit 400 in the live editor, saved HTML and reopen under a bold fallback', async () => {
    const app = mountTable(paragraphTypography)
    const editor = await editorFor()
    await waitFor(() => expect(document.activeElement).toBe(editor.view.dom))
    expect(app.state().writes).toEqual([])
    const fallback = app.container.querySelector('td')
    expect(fallback.style.fontFamily).toBe('Courier New')
    expect(fallback.style.fontWeight).toBe('600')
    expectRunTypography(editor.view.dom, 'Arial', '400')
    act(() => editor.view.dispatch(editor.state.tr.insertText('Revised', 1, 9)))
    const saved = app.state().element
    const doc = new DOMParser().parseFromString(saved.data[0][0].html, 'text/html')
    expect(doc.body.textContent).toBe('Revised')
    expectRunTypography(doc.body, 'Arial', '400')
    expect(doc.querySelector('p').style.lineHeight).toBe('1.5')
    expect(doc.querySelector('p').style.marginBottom).toBe('8px')
    expect(saved.data[0][1]).toEqual(sibling)
    expect(app.state().writes).toHaveLength(1)
    app.unmount()
    const reopened = mountTable(saved)
    const reopenedEditor = await editorFor()
    await waitFor(() => expect(document.activeElement).toBe(reopenedEditor.view.dom))
    expect(reopenedEditor.getText()).toBe('Revised')
    expectRunTypography(reopenedEditor.view.dom, 'Arial', '400')
    expect(reopened.state().writes).toEqual([])
  })

  it('synchronizes paragraph typography from external undo and redo without authoring extra writes', async () => {
    const app = mountTable(paragraphTypography)
    const editor = await editorFor()
    await waitFor(() => expect(document.activeElement).toBe(editor.view.dom))
    expect(app.state().writes).toEqual([])
    act(() => editor.view.dispatch(editor.state.tr.insertText('Changed', 1, 9)))
    const edited = app.state().element
    expect(app.state().writes).toHaveLength(1)
    act(() => app.state().setElement(paragraphTypography))
    await waitFor(() => {
      expect(editor.getText()).toBe('Original')
      expectRunTypography(editor.view.dom, 'Arial', '400')
    })
    expect(editor.view.dom.querySelector('p').style.lineHeight).toBe('1.5')
    expect(editor.view.dom.querySelector('p').style.marginBottom).toBe('8px')
    expect(app.state().element).toEqual(paragraphTypography)
    expect(app.state().writes).toHaveLength(1)
    act(() => app.state().setElement(edited))
    await waitFor(() => {
      expect(editor.getText()).toBe('Changed')
      expectRunTypography(editor.view.dom, 'Arial', '400')
    })
    expect(app.state().writes).toHaveLength(1)
  })

  it('keeps plain edits plain and preserves rich siblings', () => {
    const app = mountTable()
    fireEvent.change(app.container.querySelector('textarea'), { target: { value: '<em>Changed</em>' } })
    expect(app.state().element.data[0][2]).toBe('<em>Changed</em>')
    expect(app.state().element.data[0].slice(0, 2)).toEqual([richCell, sibling])
  })
})
