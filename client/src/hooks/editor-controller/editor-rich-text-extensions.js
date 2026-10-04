import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { MathNode } from '../../extensions/MathExtension'
import { FontFamily } from '../../extensions/FontFamily'
import { FontSize } from '../../extensions/FontSize'
import { FontWeight } from '../../extensions/tiptap-font-weight-extension'
import { LineHeight } from '../../extensions/tiptap-line-height-extension'

export function createEditorRichTextExtensions() {
  return [
    StarterKit.configure({ link: false, underline: false }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Color,
    TextStyle,
    Link.configure({ openOnClick: false }),
    Image.configure({ inline: false }),
    Placeholder.configure({ placeholder: 'Click to start typing...' }),
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
  ]
}

export function preserveBlockColors(html) {
  if (!html) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll('ul, ol').forEach((list) => {
    const { color, fontSize, lineHeight } = list.style
    if (!color && !fontSize && !lineHeight) return
    list.querySelectorAll(':scope > li').forEach((li) => {
      if (color && !li.style.color) li.style.color = color
      if (fontSize && !li.style.fontSize) li.style.fontSize = fontSize
      if (lineHeight && !li.style.lineHeight) li.style.lineHeight = lineHeight
    })
    if (color) list.style.removeProperty('color')
    if (fontSize) list.style.removeProperty('font-size')
    if (lineHeight) list.style.removeProperty('line-height')
  })
  doc.body
    .querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, div')
    .forEach((element) => {
      const { color, fontSize } = element.style
      if (!color && !fontSize) return
      const span = doc.createElement('span')
      if (color) {
        span.style.color = color
        element.style.removeProperty('color')
      }
      if (fontSize) {
        span.style.fontSize = fontSize
        element.style.removeProperty('font-size')
      }
      while (element.firstChild) span.appendChild(element.firstChild)
      element.appendChild(span)
    })
  // TipTap joins parent/child span styles with a semicolon; avoid an empty
  // declaration boundary that CSSOM parsers can mistake for a property name.
  doc.body.querySelectorAll('span[style]').forEach((span) => {
    span.setAttribute('style', span.style.cssText.replace(/;\s*$/, ''))
  })
  return doc.body.innerHTML
}
