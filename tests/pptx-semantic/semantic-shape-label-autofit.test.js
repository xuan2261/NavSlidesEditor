import { describe, expect, it } from 'vitest'
import { shapeLabelSvgString } from '../../shared/src/pptx-shape-label.js'

function element(autofit) {
  return {
    width: 200,
    height: 100,
    pptxTextDocument: {
      schemaVersion: 1,
      componentId: 'body',
      body: { autofit, wrap: true, verticalText: 'horz', verticalAlign: 't' },
      paragraphs: [
        {
          componentId: 'paragraph',
          properties: { lineSpacing: { unit: 'points', value: 20 } },
          defaultRunProperties: { fontSizePt: 12, spacingPt: 1 },
          runs: [{ componentId: 'run', kind: 'text', text: 'Native size' }],
        },
      ],
    },
  }
}

describe('shape label native autofit projection', () => {
  it('applies authored normal font and line-space factors without changing canonical text', () => {
    const input = element({ mode: 'normal', fontScale: 50000, lineSpaceReduction: 25000 })
    const before = structuredClone(input)
    const svg = shapeLabelSvgString(input)

    expect(svg).toContain('data-pptx-autofit="normal"')
    expect(svg).toContain('data-pptx-font-scale="0.5"')
    expect(svg).toContain('data-pptx-line-space-reduction="0.25"')
    expect(svg).toContain('font-size:6pt')
    expect(svg).toContain('letter-spacing:0.5pt')
    expect(svg).toContain('line-height:15pt')
    expect(input).toEqual(before)
  })

  it.each([
    [{ mode: 'normal' }, 'font-size:12pt'],
    [{ mode: 'none' }, 'font-size:12pt'],
  ])('keeps native size when no normal scale is authored: %j', (autofit, expected) => {
    const svg = shapeLabelSvgString(element(autofit))
    expect(svg).toContain(expected)
    if (autofit.mode === 'none') expect(svg).not.toContain('data-pptx-autofit')
  })
})
