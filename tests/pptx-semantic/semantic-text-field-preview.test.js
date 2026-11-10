import { describe, expect, it } from 'vitest'
import { evaluateTextFieldPreviews } from '../../shared/src/pptx-text-field-preview.js'
import { shapeLabelSvgString } from '../../shared/src/pptx-shape-label.js'

function document() {
  return {
    schemaVersion: 1,
    componentId: 'body',
    body: { autofit: { mode: 'none' } },
    paragraphs: [
      {
        componentId: 'paragraph',
        runs: [
          { componentId: 'number', kind: 'field', text: '‹#›', field: { id: 'n', type: 'slidenum' } },
          { componentId: 'title', kind: 'field', text: 'Cached', field: { id: 't', type: 'slidetitle' } },
          { componentId: 'date', kind: 'field', text: 'old', field: { id: 'd', type: 'datetime5' } },
          { componentId: 'custom', kind: 'field', text: 'source cache', field: { id: 'c', type: 'vendor.custom' } },
        ],
      },
    ],
  }
}

describe('derived semantic field previews', () => {
  it('binds slide and date context while preserving canonical field definitions and source caches', () => {
    const source = document()
    const before = structuredClone(source)
    const result = evaluateTextFieldPreviews(source, {
      slideNumber: 7,
      slideTitle: 'Current title',
      date: new Date('2026-10-20T13:14:15Z'),
      timeZone: 'UTC',
      locale: 'en-US',
    })

    expect(result.paragraphs[0].runs.map((run) => run.text)).toEqual([
      '7',
      'Current title',
      '2026-10-20',
      'source cache',
    ])
    expect(result.paragraphs[0].runs.map((run) => run.field)).toEqual(
      source.paragraphs[0].runs.map((run) => run.field)
    )
    expect(source).toEqual(before)
  })

  it('leaves unresolved fields and the document reference unchanged without usable context', () => {
    const source = document()
    expect(evaluateTextFieldPreviews(source, {})).toEqual(source)
    expect(source.paragraphs[0].runs[0].text).toBe('‹#›')
  })

  it('renders evaluated text with retained field identity attributes', () => {
    const preview = evaluateTextFieldPreviews(document(), {
      slideNumber: 3,
      slideTitle: 'Overview',
      datePreviews: { datetime5: '2026-10-20' },
    })
    const svg = shapeLabelSvgString({ width: 200, height: 100, pptxTextDocument: preview })
    expect(svg).toContain('data-pptx-field-id="n"')
    expect(svg).toContain('data-pptx-field-type="slidenum"')
    expect(svg).toContain('>3</span>')
    expect(svg).toContain('>Overview</span>')
  })
})
