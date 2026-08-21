import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { afterEach, describe, expect, it } from 'vitest'
import { MathNode } from './extensions/MathExtension'
import { FontFamily } from './extensions/FontFamily'
import { FontSize } from './extensions/FontSize'
import { FontWeight } from './extensions/tiptap-font-weight-extension'
import { LineHeight } from './extensions/tiptap-line-height-extension'

let editor

afterEach(() => editor?.destroy())

describe('TipTap v2 persisted HTML compatibility', () => {
  it('round-trips existing rich text semantics', () => {
    editor = new Editor({
      extensions: [
        StarterKit,
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Color,
        TextStyle,
        Link.configure({ openOnClick: false }),
        MathNode,
        FontFamily,
        FontSize,
        FontWeight,
        LineHeight,
        Highlight.configure({ multicolor: true }),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: `
        <p style="line-height: 1.5">
          <span style="color: #ff0000; font-family: Arial; font-size: 24px; font-weight: 700">Styled</span>
          <mark data-color="#ffff00" style="background-color: #ffff00">highlight</mark>
          <a href="https://example.com">link</a>
          <span data-math-latex="x^2" data-math-display="false"></span>
        </p>
        <table><tbody><tr><th><p>Head</p></th><td><p>Cell</p></td></tr></tbody></table>
      `,
    })

    const document = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
    const styled = document.querySelector('span[style]')
    const highlight = document.querySelector('mark')
    const math = document.querySelector('[data-math-latex]')

    expect(styled?.style.color).toBe('rgb(255, 0, 0)')
    expect(styled?.style.fontFamily).toBe('Arial')
    expect(styled?.style.fontSize).toBe('24px')
    expect(styled?.style.fontWeight).toBe('700')
    expect(document.querySelector('p')?.style.lineHeight).toBe('1.5')
    expect(highlight?.getAttribute('data-color')).toBe('#ffff00')
    expect(document.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
    expect(math?.getAttribute('data-math-latex')).toBe('x^2')
    expect(document.querySelector('th')?.textContent).toBe('Head')
    expect(document.querySelector('td')?.textContent).toBe('Cell')
  })
})
