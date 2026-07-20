import { describe, expect, it } from 'vitest'
import eligibilityModule from './tiptap-single-plain-run-eligibility.js'

const { normalizeTipTapSinglePlainRun, transportFromTipTapContent } = eligibilityModule

function documentWith(content) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content }],
  }
}

function jsonTransport(content) {
  return {
    format: 'tiptap-json',
    schemaVersion: 1,
    document: documentWith(content),
  }
}

describe('TipTap single plain run eligibility', () => {
  it('normalizes the exact production JSON and HTML plain-run transports', () => {
    expect(normalizeTipTapSinglePlainRun(jsonTransport([
      { type: 'text', text: 'Plain & text' },
    ]))).toEqual({ ok: true, format: 'tiptap-json', normalizedText: 'Plain & text' })

    expect(normalizeTipTapSinglePlainRun({
      format: 'tiptap-html', schemaVersion: 1, html: '<p>Plain &amp; text</p>',
    })).toEqual({ ok: true, format: 'tiptap-html', normalizedText: 'Plain & text' })
  })

  it('derives transports from the persisted HTML or JSON representation', () => {
    expect(transportFromTipTapContent('<p>After</p>')).toEqual({
      format: 'tiptap-html', schemaVersion: 1, html: '<p>After</p>',
    })
    expect(transportFromTipTapContent(documentWith([{ type: 'text', text: 'After' }]))).toEqual({
      format: 'tiptap-json', schemaVersion: 1,
      document: documentWith([{ type: 'text', text: 'After' }]),
    })
  })

  it('uses empty strings consistently and rejects XML-unsafe text in both transports', () => {
    expect(normalizeTipTapSinglePlainRun(jsonTransport([{ type: 'text', text: '' }]))).toEqual({
      ok: true, format: 'tiptap-json', normalizedText: '',
    })
    expect(normalizeTipTapSinglePlainRun({
      format: 'tiptap-html', schemaVersion: 1, html: '<p></p>',
    })).toEqual({ ok: true, format: 'tiptap-html', normalizedText: '' })
    for (const text of ['', '﷐', '\uD800']) {
      expect(normalizeTipTapSinglePlainRun(jsonTransport([{ type: 'text', text }]))).toMatchObject({
        ok: false, code: 'TIPTAP_XML_CHARACTER_INVALID',
      })
    }
    for (const input of [
      jsonTransport([{ type: 'text', text: 'One\r\nTwo' }]),
      { format: 'tiptap-html', schemaVersion: 1, html: '<p>One\r\nTwo</p>' },
    ]) {
      expect(normalizeTipTapSinglePlainRun(input)).toMatchObject({
        ok: false, code: 'TIPTAP_HARD_BREAK_NOT_ALLOWED',
      })
    }
    expect(normalizeTipTapSinglePlainRun({
      format: 'tiptap-html', schemaVersion: 1, html: '<p>&#xFDD0;</p>',
    })).toMatchObject({ ok: false, code: 'TIPTAP_XML_CHARACTER_INVALID' })
  })

  it.each([
    ['legacy plain string', 'After', 'TIPTAP_LEGACY_PLAIN_STRING_NOT_ALLOWED'],
    ['multiple paragraphs', {
      ...jsonTransport([{ type: 'text', text: 'One' }]),
      document: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Two' }] },
        ],
      },
    }, 'TIPTAP_DOCUMENT_PARAGRAPH_COUNT_INVALID'],
    ['multiple runs', jsonTransport([
      { type: 'text', text: 'One' },
      { type: 'text', text: 'Two' },
    ]), 'TIPTAP_PARAGRAPH_RUN_COUNT_INVALID'],
    ['bold mark', jsonTransport([
      { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
    ]), 'TIPTAP_RUN_MARKS_NOT_ALLOWED'],
    ['link mark', jsonTransport([
      { type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href: 'https://example.test' } }] },
    ]), 'TIPTAP_LINK_NOT_ALLOWED'],
    ['hard break node', jsonTransport([{ type: 'hardBreak' }]), 'TIPTAP_HARD_BREAK_NOT_ALLOWED'],
    ['literal hard break', jsonTransport([{ type: 'text', text: 'One\nTwo' }]), 'TIPTAP_HARD_BREAK_NOT_ALLOWED'],
    ['field', jsonTransport([{ type: 'field', attrs: { type: 'date' } }]), 'TIPTAP_FIELD_NOT_ALLOWED'],
    ['list', {
      ...jsonTransport([{ type: 'text', text: 'List' }]),
      document: { type: 'doc', content: [{ type: 'bulletList', content: [] }] },
    }, 'TIPTAP_LIST_NOT_ALLOWED'],
    ['tab', jsonTransport([{ type: 'tab' }]), 'TIPTAP_TAB_NOT_ALLOWED'],
    ['inline node', jsonTransport([{ type: 'image', attrs: { src: 'image.png' } }]), 'TIPTAP_INLINE_NODE_NOT_ALLOWED'],
    ['style attrs', {
      ...jsonTransport([{ type: 'text', text: 'Styled' }]),
      document: {
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Styled' }] }],
      },
    }, 'TIPTAP_STYLE_NOT_ALLOWED'],
    ['rich HTML', {
      format: 'tiptap-html', schemaVersion: 1, html: '<p><strong>Bold</strong></p>',
    }, 'TIPTAP_HTML_NOT_SINGLE_PLAIN_PARAGRAPH'],
  ])('rejects %s with a typed fail-closed code', (_label, transport, code) => {
    expect(normalizeTipTapSinglePlainRun(transport)).toEqual({ ok: false, code })
  })
})
