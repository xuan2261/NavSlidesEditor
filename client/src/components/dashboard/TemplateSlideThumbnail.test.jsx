import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import TemplateSlideThumbnail from './TemplateSlideThumbnail'

describe('TemplateSlideThumbnail', () => {
  it('renders slide background and trusted text content', () => {
    render(
      <TemplateSlideThumbnail
        width={320}
        height={180}
        slide={{
          background: { type: 'color', color: '#123456' },
          elements: [
            {
              id: 'title',
              type: 'text',
              x: 10,
              y: 20,
              width: 200,
              height: 60,
              content: '<strong>Template Title</strong>',
            },
          ],
        }}
      />
    )

    expect(screen.getByTestId('template-slide-thumbnail').style.backgroundColor).toBe('rgb(18, 52, 86)')
    expect(screen.getByText('Template Title')).toBeTruthy()
  })

  it('renders fallback labels for lightweight non-text elements', () => {
    render(
      <TemplateSlideThumbnail
        slide={{
          elements: [
            { id: 'chart', type: 'chart', x: 0, y: 0, width: 100, height: 80 },
            { id: 'table', type: 'table', x: 110, y: 0, width: 100, height: 80 },
          ],
        }}
      />
    )

    expect(screen.getByText('Chart')).toBeTruthy()
    expect(screen.getByText('Table')).toBeTruthy()
  })
})
