import { describe, expect, it } from 'vitest'
import {
  getPptxLayout,
  htmlToPptTextRuns,
  normalizeCssColor,
  normalizeImageSource,
} from './export-pptx-core'

describe('export-pptx-core', () => {
  it('derives landscape and portrait layouts from aspect ratio', () => {
    expect(getPptxLayout({ width: 960, height: 540 })).toEqual({ width: 10, height: 5.625 })
    expect(getPptxLayout({ width: 960, height: 720 })).toEqual({ width: 10, height: 7.5 })
    expect(getPptxLayout({ width: 540, height: 960 })).toEqual({ width: 5.625, height: 10 })
    expect(getPptxLayout({ width: 1920, height: 1080 })).toEqual({ width: 10, height: 5.625 })
  })

  it('normalizes hex and rgba colors to PPT format', () => {
    expect(normalizeCssColor('#abc')).toEqual({ color: 'AABBCC', transparency: undefined })
    expect(normalizeCssColor('rgba(255, 0, 0, 0.25)')).toEqual({ color: 'FF0000', transparency: 75 })
    expect(normalizeCssColor('transparent', 'FFFFFF')).toEqual({ color: 'FFFFFF', transparency: 100 })
  })

  it('chooses data for data URIs and path for URLs', () => {
    expect(normalizeImageSource('data:image/png;base64,abc')).toEqual({
      data: 'data:image/png;base64,abc',
    })
    expect(normalizeImageSource('/uploads/figure.png')).toEqual({ path: '/uploads/figure.png' })
  })

  it('converts rich HTML into PPT runs with bullets and emphasis', () => {
    const runs = htmlToPptTextRuns(
      '<h2 style="text-align:center">Heading</h2><p>Hello <strong>bold</strong> and <em>italic</em></p><ul><li>One</li><li><u>Two</u></li></ul>'
    )

    expect(runs[0].text).toBe('Heading')
    expect(runs[0].options.bold).toBe(true)
    expect(runs[0].options.align).toBe('center')
    expect(runs.some((run) => run.text === 'bold' && run.options.bold)).toBe(true)
    expect(runs.some((run) => run.text === 'italic' && run.options.italic)).toBe(true)
    expect(runs.some((run) => run.text === 'One' && run.options.bullet?.type === 'bullet')).toBe(true)
    expect(runs.some((run) => run.text === 'Two' && run.options.underline)).toBe(true)
  })
})
