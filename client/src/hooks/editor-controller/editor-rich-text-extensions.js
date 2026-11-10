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
import { NativeParagraphLayout, NativeTab } from '../../extensions/tiptap-native-paragraph-layout'
import { Extension, Node } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { semanticTextFromTipTap } from '../../utils/pptx-semantic-text-bridge'
import { textOutlineCss } from 'revealjs-shared/src/pptx-text-outline.js'
import { SemanticEquation } from '../../extensions/tiptap-semantic-equation'

const SemanticTextIdentity = Extension.create({
  name: 'semanticTextIdentity',
  addStorage: () => ({ layoutCache: null }),
  addCommands() {
    return { cacheSemanticTextLayout: (key, content) => ({ editor }) => {
      editor.storage.semanticTextIdentity.layoutCache = { key, content }
      return true
    } }
  },
  addGlobalAttributes() {
    return [
      { types: ['paragraph', 'heading'], key: 'pptxParagraph' },
      { types: ['textStyle', 'hardBreak', 'nativeTab', 'semanticEmptyRun'], key: 'pptxRun' },
    ].map(({ types, key }) => ({ types, attributes: {
      [key]: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute(`data-${key.toLowerCase()}`)
          if (!value || value.length > 8388608) return null
          try { return JSON.parse(value) } catch { return null }
        },
        renderHTML: (attrs) => {
          if (!attrs[key]) return {}
          const metadata = attrs[key]
          return { [`data-${key.toLowerCase()}`]: JSON.stringify(metadata),
            ...(key === 'pptxRun' ? { style: textOutlineCss(metadata.outline ?? metadata.run?.properties?.outline) } : {}) }
        },
      },
    } }))
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      filterTransaction: (transaction, state) => {
        if (!transaction.docChanged || transaction.getMeta('preventUpdate') || !state.doc.firstChild?.attrs.pptxParagraph) return true
        try { semanticTextFromTipTap(transaction.doc.toJSON()); return true } catch { return false }
      },
    })]
  },
})
const SemanticEmptyRun = Node.create({
  name: 'semanticEmptyRun', group: 'inline', inline: true, atom: true, selectable: false,
  parseHTML: () => [{ tag: 'span[data-pptx-empty-run]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', { ...HTMLAttributes, 'data-pptx-empty-run': '1', style: 'display:inline-block;width:0' }],
  renderText: () => '',
})

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
    NativeParagraphLayout,
    NativeTab,
    SemanticTextIdentity,
    SemanticEmptyRun,
    SemanticEquation,
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
    const { color, fontSize, fontFamily, fontWeight, lineHeight } = list.style
    if (!color && !fontSize && !fontFamily && !fontWeight && !lineHeight) return
    list.querySelectorAll(':scope > li').forEach((li) => {
      if (color && !li.style.color) li.style.color = color
      if (fontSize && !li.style.fontSize) li.style.fontSize = fontSize
      if (fontFamily && !li.style.fontFamily) li.style.fontFamily = fontFamily
      if (fontWeight && !li.style.fontWeight) li.style.fontWeight = fontWeight
      if (lineHeight && !li.style.lineHeight) li.style.lineHeight = lineHeight
    })
    if (color) list.style.removeProperty('color')
    if (fontSize) list.style.removeProperty('font-size')
    if (fontFamily) list.style.removeProperty('font-family')
    if (fontWeight) list.style.removeProperty('font-weight')
    if (lineHeight) list.style.removeProperty('line-height')
  })
  doc.body
    .querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, div')
    .forEach((element) => {
      const { color, fontSize, fontFamily, fontWeight } = element.style
      if (!color && !fontSize && !fontFamily && !fontWeight) return
      const span = doc.createElement('span')
      if (color) {
        span.style.color = color
        element.style.removeProperty('color')
      }
      if (fontSize) {
        span.style.fontSize = fontSize
        element.style.removeProperty('font-size')
      }
      if (fontFamily) {
        span.style.fontFamily = fontFamily
        element.style.removeProperty('font-family')
      }
      if (fontWeight) {
        span.style.fontWeight = fontWeight
        element.style.removeProperty('font-weight')
      }
      while (element.firstChild) span.appendChild(element.firstChild)
      element.appendChild(span)
    })
  // TipTap joins parent/child span styles with a semicolon; avoid an empty
  // declaration boundary that CSSOM parsers can mistake for a property name.
  doc.body.querySelectorAll('span[style]').forEach((span) => {
    const raw = span.getAttribute('style')
    if (raw) span.setAttribute('style', raw.trim().replace(/;+$/, ''))
  })
  return doc.body.innerHTML
}
