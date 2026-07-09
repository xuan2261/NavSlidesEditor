import { describe, expect, it } from 'vitest'

import {
  collectElementSearchMatches,
  replaceAllInSlides,
  replaceInHtml,
  replaceOnceInTableCell,
} from './find-replace-helpers'

describe('find replace helpers', () => {
  it('[cap:flow.find-replace] supports replacing matches with an empty string', () => {
    const slides = [
      {
        id: 'slide-1',
        elements: [
          { id: 'code-1', type: 'code', content: 'Hello World' },
          { id: 'shape-1', type: 'shape', text: 'Hello Shape' },
        ],
      },
    ]

    const updatedSlides = replaceAllInSlides(slides, 'Hello', '', false)

    expect(updatedSlides[0].elements[0].content).toBe(' World')
    expect(updatedSlides[0].elements[1].text).toBe(' Shape')
  })

  it('preserves full HTML embed documents when replacing body text', () => {
    const slides = [
      {
        id: 'slide-1',
        elements: [
          {
            id: 'html-1',
            type: 'html',
            content:
              '<!doctype html><html><head><style>body{color:red}</style><script>window.message="Hello";</script></head><body><h1>Hello</h1><p>World</p></body></html>',
          },
        ],
      },
    ]

    const updatedSlides = replaceAllInSlides(slides, 'Hello', 'Hi', false)
    const html = updatedSlides[0].elements[0].content

    expect(html).toContain('<html>')
    expect(html).toContain('<head>')
    expect(html).toContain('body{color:red}')
    expect(html).toContain('window.message="Hello";')
    expect(html).toContain('<h1>Hi</h1>')
    expect(html).toContain('<p>World</p>')
  })

  it('can replace only the first HTML text match', () => {
    const html = '<p>Hello</p><p>Hello</p>'

    expect(replaceInHtml(html, 'Hello', 'Hi', false, false)).toBe('<p>Hi</p><p>Hello</p>')
  })

  it('replaceAllInSlides replaces text inside table.data cells', () => {
    const slides = [
      {
        id: 'slide-1',
        elements: [
          {
            id: 't1',
            type: 'table',
            data: [
              ['Hello', 'World'],
              ['Hello', 'X'],
            ],
            mergedCells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }],
          },
        ],
      },
    ]
    const updated = replaceAllInSlides(slides, 'Hello', 'Hi', false)
    expect(updated[0].elements[0].data).toEqual([
      ['Hi', 'World'],
      ['Hi', 'X'],
    ])
    expect(updated[0].elements[0].mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }])
  })

  it('replaceAllInSlides replaces table cells on vertical child slides', () => {
    const slides = [
      {
        id: 'slide-1',
        elements: [],
        children: [
          {
            id: 'child-0',
            elements: [
              {
                id: 't-child',
                type: 'table',
                data: [['FindMe']],
              },
            ],
          },
        ],
      },
    ]
    const updated = replaceAllInSlides(slides, 'FindMe', 'Done', true)
    expect(updated[0].children[0].elements[0].data).toEqual([['Done']])
  })

  it('collectElementSearchMatches finds table cell positions', () => {
    const hits = collectElementSearchMatches(
      {
        id: 't1',
        type: 'table',
        data: [
          ['aa', 'bb'],
          ['xx aa yy', 'zz'],
        ],
      },
      'aa',
      false
    )
    expect(hits).toHaveLength(2)
    expect(hits[0]).toMatchObject({ tableRow: 0, tableCol: 0, pos: 0 })
    expect(hits[1]).toMatchObject({ tableRow: 1, tableCol: 0, pos: 3 })
  })

  it('replaceOnceInTableCell replaces only the targeted cell occurrence', () => {
    const el = {
      id: 't1',
      type: 'table',
      data: [
        ['Hello Hello', 'Hello'],
        ['x', 'y'],
      ],
    }
    const next = replaceOnceInTableCell(el, 'Hello', 'Hi', false, 0, 0, 0)
    expect(next.data[0][0]).toBe('Hi Hello')
    expect(next.data[0][1]).toBe('Hello')
  })
})
