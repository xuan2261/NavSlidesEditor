import { describe, expect, it } from 'vitest'
import { collectElementSearchMatches, replaceAllInSlides, replaceOnceInTableCell } from './find-replace-helpers'

const rich = (html) => ({ html })
const table = (data) => ({ id: 'rich-table', type: 'table', data })
const text = (cell) => new DOMParser().parseFromString(cell.html, 'text/html').body.textContent

function replace(element, search, replacement) {
  return replaceAllInSlides([{ id: 'slide', elements: [element] }], search, replacement, true)[0].elements[0]
}

describe('rich table search and replacement', () => {
  it('counts decoded matches spanning runs, preserving repeated decoded offsets', () => {
    const element = table([[rich('<p><strong>cat</strong><span> &amp; cat</span></p>'), '<b>cat</b>', 0, false]])
    expect(collectElementSearchMatches(element, 'cat', true).map(({ pos, tableCol }) => [tableCol, pos]))
      .toEqual([[0, 0], [0, 6], [1, 3]])
    expect(collectElementSearchMatches(element, 'cat & cat', true)).toHaveLength(1)
    expect(collectElementSearchMatches(element, '<strong>', true)).toEqual([])
    expect(collectElementSearchMatches(element, 'false', true)[0]).toMatchObject({ tableCol: 3, pos: 0 })
  })

  it('replaces across runs without flattening rich markup or touching unrelated cells', () => {
    const sibling = rich('<p style="font-size:22px"><em>Sibling</em></p>')
    const element = table([[rich('<p><strong>Hello</strong><span style="font-weight:400"> world tail</span></p>'), sibling, 0, false]])
    const next = replace(element, 'Hello world', 'Revised')
    expect(text(next.data[0][0])).toBe('Revised tail')
    expect(next.data[0][0].html).toContain('<strong>')
    const doc = new DOMParser().parseFromString(next.data[0][0].html, 'text/html')
    expect(doc.querySelector('span').textContent).toBe(' tail')
    expect(doc.querySelector('span').style.fontWeight).toBe('400')
    expect(next.data[0][0]).not.toHaveProperty('text')
    expect(next.data[0].slice(1)).toEqual([sibling, 0, false])
    expect(element.data[0][0].html).toContain('Hello')
  })

  it('targets the second match by decoded offset and decodes literal entities exactly once', () => {
    const element = table([[rich('<p><strong>A &amp; A</strong> &amp;amp; &nbsp; B</p>')]])
    const next = replaceOnceInTableCell(element, 'A', 'Second', true, 0, 0, 4)
    expect(text(next.data[0][0])).toBe('A & Second &amp; \u00a0 B')
    expect(next.data[0][0].html).toContain('<strong>A &amp; Second</strong>')
    const decoded = replace(next, '&amp;', 'entity')
    expect(text(decoded.data[0][0])).toBe('A & Second entity \u00a0 B')
  })

  it('uses paragraph and br boundaries for searches and replacements', () => {
    const element = table([[rich('<p><strong>First</strong><br>Second</p><p>Third</p>')]])
    expect(collectElementSearchMatches(element, 'First\nSecond\nThird', true)).toHaveLength(1)
    const next = replace(element, 'Second\nThird', 'Joined')
    expect(text(next.data[0][0])).toContain('Joined')
    expect(collectElementSearchMatches(next, 'Second', true)).toEqual([])
    expect(next.data[0][0].html).toContain('<strong>First</strong>')
  })

  it('uses standard dollar replacement semantics without inserting markup', () => {
    const element = table([[rich('<p><strong>cat</strong> cat</p>'), '<em>cat</em>']])
    const next = replace(element, 'cat', '$$-$&-<b>')
    expect(text(next.data[0][0])).toBe('$-cat-<b> $-cat-<b>')
    expect(new DOMParser().parseFromString(next.data[0][0].html, 'text/html').querySelector('b')).toBeNull()
    expect(next.data[0][1]).toBe('<em>$-cat-<b></em>')
  })
})
