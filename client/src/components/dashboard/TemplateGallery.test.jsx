import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TemplateGallery from './TemplateGallery'
import TemplatePreview from './TemplatePreview'
import TemplatePickerModal from '../TemplatePickerModal'
import { SLIDE_TEMPLATES } from '../../data/slide-templates'

const marketplacePayload = {
  categories: [
    { id: 'business', name: 'Kinh doanh', icon: 'briefcase' },
    { id: 'interactive', name: 'Tương tác', icon: 'mouse-pointer-click' },
  ],
  templates: [
    {
      id: 'pitch',
      title: 'Pitch Deck',
      description: 'Business deck',
      category: 'business',
      tags: ['minimal'],
      slides: [{ id: 's1', elements: [] }],
    },
    {
      id: 'interactive-lab',
      title: 'Interactive Lab',
      description: 'Simulation deck',
      category: 'electronics',
      tags: ['interactive'],
      slides: [{ id: 's1', elements: [] }],
    },
    {
      id: 'missing-description',
      title: 'Metadata Only Deck',
      category: 'electronics',
      tags: ['Simulation'],
      slides: [{ id: 's1', elements: [] }],
    },
  ],
}

describe('template dashboard components', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(marketplacePayload),
        })
      )
    )
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('filters TemplateGallery categories by template tags', async () => {
    render(<TemplateGallery onSelectTemplate={vi.fn()} onClose={vi.fn()} />)

    expect(await screen.findByText('Pitch Deck')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tương tác/i }))

    expect(screen.getByText('Interactive Lab')).toBeTruthy()
    expect(screen.queryByText('Pitch Deck')).toBeNull()
  })

  it('searches TemplateGallery safely when metadata fields are missing', async () => {
    render(<TemplateGallery onSelectTemplate={vi.fn()} onClose={vi.fn()} />)

    expect(await screen.findByText('Pitch Deck')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Tìm template...'), {
      target: { value: 'simulation' },
    })

    expect(screen.getByText('Metadata Only Deck')).toBeTruthy()
  })

  it('clears TemplateGallery search without losing loaded templates', async () => {
    render(<TemplateGallery onSelectTemplate={vi.fn()} onClose={vi.fn()} />)

    expect(await screen.findByText('Pitch Deck')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Tìm template...'), {
      target: { value: 'no match' },
    })
    expect(screen.getByText('Không tìm thấy "no match"')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    expect(screen.getByText('Pitch Deck')).toBeTruthy()
    expect(screen.getByText('Interactive Lab')).toBeTruthy()
  })

  it('stores favorites and shows an explicit favorites empty state', async () => {
    render(<TemplateGallery onSelectTemplate={vi.fn()} onClose={vi.fn()} />)

    expect(await screen.findByText('Pitch Deck')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Yêu thích/i }))
    expect(screen.getByText('No favorite templates yet.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Tất cả/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /Add to favorites/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /Yêu thích/i }))

    expect(screen.getByText('Pitch Deck')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('navslides-favorite-templates'))).toEqual(['pitch'])
  })

  it('lets TemplatePreview insert selected slides', async () => {
    const onInsertSlides = vi.fn()
    render(
      <TemplatePreview
        template={{
          id: 'template',
          title: 'Reusable Template',
          description: 'Preview deck',
          category: 'business',
          slides: [
            { id: 's1', elements: [] },
            { id: 's2', elements: [] },
          ],
        }}
        onInsertSlides={onInsertSlides}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Insert into Current/i }))
    fireEvent.click(screen.getByRole('button', { name: /Insert 2 Slides/i }))

    expect(onInsertSlides).toHaveBeenCalledWith(
      [
        { id: 's1', elements: [] },
        { id: 's2', elements: [] },
      ],
      'after'
    )
  })

  it('lets TemplatePickerModal select a slide layout', () => {
    const onSelect = vi.fn()
    const firstTemplate = Object.entries(SLIDE_TEMPLATES)[0]
    render(<TemplatePickerModal onSelect={onSelect} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: new RegExp(firstTemplate[1].label, 'i') }))

    expect(onSelect).toHaveBeenCalledWith(firstTemplate[0])
  })
})
