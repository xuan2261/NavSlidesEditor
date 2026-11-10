import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createEditorRichTextExtensions } from '../hooks/editor-controller/editor-rich-text-extensions'
import { sanitizeRichTextHtml } from 'revealjs-shared/src/content-safety.js'

let editor
function documentOf(html) {
  return new DOMParser().parseFromString(html, 'text/html')
}
afterEach(() => editor?.destroy())
describe('source paragraph edit persistence', () => {
  it('keeps tabs, authored NBSP, ordinary wrapping spaces and additive spacing after an edit', () => {
    const text = '\tFirst ordinary word\u00a0bound\tLast'
    editor = new Editor({
      extensions: createEditorRichTextExtensions(),
      parseOptions: { preserveWhitespace: 'full' },
      content:
        '<p style="white-space:pre-wrap;tab-size:72px;text-indent:36px;margin-left:12px;margin-top:0px;margin-bottom:0px;padding-top:4px;padding-bottom:4px">' +
        text +
        '</p>',
    })
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, '!')
    const result = documentOf(sanitizeRichTextHtml(editor.getHTML())).querySelector('p')
    expect(result.textContent).toBe(text + '!')
    expect(result.style.whiteSpace).toBe('pre-wrap')
    expect(result.style.tabSize).toBe('72px')
    expect(result.style.textIndent).toBe('36px')
    expect(result.style.marginLeft).toBe('12px')
    expect(result.style.paddingTop).toBe('4px')
    expect(result.style.paddingBottom).toBe('4px')
    expect(result.style.marginBottom).toBe('0px')
  })
  it('retains explicit tab alignment, rich link semantics and the tab mark after changing text', () => {
    editor = new Editor({
      extensions: createEditorRichTextExtensions(),
      parseOptions: { preserveWhitespace: 'full' },
      content:
        '<p style="white-space:pre-wrap;tab-size:72px;--pptx-tab-stops:90:l,180:r,270:ctr,360:dec">A<span style="--pptx-tab:1">\t</span><a href="https://example.com"><strong>Link</strong></a></p>',
    })
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, '!')
    const result = documentOf(sanitizeRichTextHtml(editor.getHTML()))
    expect(result.querySelector('p').style.getPropertyValue('--pptx-tab-stops')).toBe(
      '90:l,180:r,270:ctr,360:dec'
    )
    expect(result.querySelector('span[style*="--pptx-tab"]').textContent).toBe('\t')
    expect(result.querySelector('a').getAttribute('href')).toBe('https://example.com')
    expect(result.querySelector('strong').textContent).toContain('Link')
  })
  it('keeps adjacent source tabs as independently laid-out units through editing and reopen', () => {
    const content =
      '<p style="white-space:pre-wrap;tab-size:72px;--pptx-tab-stops:90:l,180:r">A<span style="--pptx-tab:1">\t</span><span style="--pptx-tab:1">\t</span>B</p>'
    editor = new Editor({
      extensions: createEditorRichTextExtensions(),
      parseOptions: { preserveWhitespace: 'full' },
      content,
    })
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, '!')
    const saved = editor.getHTML()
    const parsed = documentOf(saved)
    expect(parsed.querySelector('p').textContent).toBe('A\t\tB!')
    expect(
      [...parsed.querySelectorAll('span[style*="--pptx-tab"]')].map((span) => span.textContent)
    ).toEqual(['\t', '\t'])
    expect(editor.getText()).toBe('A\t\tB!')
    editor.commands.setContent(saved, {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: 'full' },
    })
    expect(editor.getText()).toBe('A\t\tB!')
  })
})
