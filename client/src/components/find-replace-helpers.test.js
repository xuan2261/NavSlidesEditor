import { describe, expect, it } from 'vitest'

import { replaceAllInSlides, replaceInHtml } from './find-replace-helpers'

describe('find replace helpers', () => {
  it('supports replacing matches with an empty string', () => {
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
})
