import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TableProperties from './table-properties'

const rich = { html: '<p><strong>Original</strong><span style="font-weight:400;font-size:19px"> normal\u00a0text &amp; &amp;amp;</span></p>' }
const sibling = { html: '<p><em>Sibling</em></p>' }

describe('table properties rich text authority', () => {
  it('authors decoded plain text while preserving rich leaves and unrelated cells after reopen', () => {
    let saved
    function Harness({ seed = [[rich, sibling, '<b>literal</b>', 0, false]] }) {
      const [element, setElement] = useState({ id: 'table', type: 'table', data: seed })
      saved = element
      return <TableProperties element={element} onUpdate={(patch) => setElement((current) => ({ ...current, ...patch }))} />
    }
    const app = render(<Harness />)
    expect(screen.getByTestId('prop-table-cell-0-0').value).toBe('Original normal\u00a0text & &amp;')
    expect(screen.getByTestId('prop-table-cell-0-2').value).toBe('<b>literal</b>')
    fireEvent.change(screen.getByTestId('prop-table-cell-0-0'), { target: { value: 'Revised normal\u00a0text & &amp;' } })
    const cell = saved.data[0][0]
    const doc = new DOMParser().parseFromString(cell.html, 'text/html')
    expect(doc.querySelector('strong').textContent).toBe('Revised')
    expect(doc.querySelector('span').style.fontWeight).toBe('400')
    expect(doc.querySelector('span').style.fontSize).toBe('19px')
    expect(doc.body.textContent).toBe('Revised normal\u00a0text & &amp;')
    expect(cell).not.toHaveProperty('text')
    expect(saved.data[0].slice(1)).toEqual([sibling, '<b>literal</b>', 0, false])
    const data = saved.data
    app.unmount()
    render(<Harness seed={data} />)
    expect(screen.getByTestId('prop-table-cell-0-0').value).toBe('Revised normal\u00a0text & &amp;')
    fireEvent.change(screen.getByTestId('prop-table-cell-0-2'), { target: { value: '<em>plain</em>' } })
    expect(saved.data[0][2]).toBe('<em>plain</em>')
    expect(saved.data[0][0]).toEqual(cell)
  })

  it.each([
    ['plain paragraphs', '<p>First</p><p>Second<br>Third</p>'],
    ['formatted paragraphs', '<p style="font-family:Arial;font-weight:400"><strong>First</strong></p><p style="line-height:1.4;margin-bottom:6px"><span style="font-size:19px;font-weight:400">Second<br>Third</span></p>'],
  ])('exposes and preserves paragraph and br boundaries when appending through %s', (_name, html) => {
    let saved
    function Harness({ seed = [[{ html }, sibling]] }) {
      const [element, setElement] = useState({ id: 'table', type: 'table', data: seed })
      saved = element
      return <TableProperties element={element} onUpdate={(patch) => setElement((current) => ({ ...current, ...patch }))} />
    }
    const app = render(<Harness />)
    const control = screen.getByRole('textbox', { name: 'Table cell row 1 column 1' })
    expect(control.value).toBe('First\nSecond\nThird')
    fireEvent.change(control, { target: { value: `${control.value} suffix` } })
    const cell = saved.data[0][0]
    const doc = new DOMParser().parseFromString(cell.html, 'text/html')
    const paragraphs = doc.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    expect([...paragraphs].map((paragraph) => paragraph.textContent)).toEqual(['First', 'SecondThird suffix'])
    expect(paragraphs[1].querySelectorAll('br')).toHaveLength(1)
    expect(paragraphs[1].innerHTML).toContain('Second<br>Third suffix')
    if (_name === 'formatted paragraphs') {
      expect(paragraphs[0].querySelector('strong').textContent).toBe('First')
      expect(paragraphs[0].style.fontFamily).toBe('Arial')
      expect(paragraphs[0].style.fontWeight).toBe('400')
      expect(paragraphs[1].style.lineHeight).toBe('1.4')
      expect(paragraphs[1].style.marginBottom).toBe('6px')
      expect(paragraphs[1].querySelector('span').style.fontSize).toBe('19px')
      expect(paragraphs[1].querySelector('span').style.fontWeight).toBe('400')
    }
    expect(cell).not.toHaveProperty('text')
    expect(saved.data[0][1]).toEqual(sibling)
    const data = saved.data
    app.unmount()
    render(<Harness seed={data} />)
    expect(screen.getByRole('textbox', { name: 'Table cell row 1 column 1' }).value).toBe('First\nSecond\nThird suffix')
    expect(saved.data[0][0]).toEqual(cell)
  })
})
