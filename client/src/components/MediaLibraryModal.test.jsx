import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MediaLibraryModal from './MediaLibraryModal'

vi.mock('../utils/api', () => ({
  api: {
    getMedia: vi.fn(),
    uploadFile: vi.fn(),
    deleteMedia: vi.fn(),
  },
}))

vi.mock('../services/unsplash', () => ({ searchUnsplash: vi.fn(() => []) }))
vi.mock('../services/giphy', () => ({ searchGiphy: vi.fn(() => []) }))

const { api } = await import('../utils/api')

describe('MediaLibraryModal', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('caps the initial local media render for large libraries', async () => {
    api.getMedia.mockResolvedValue(
      Array.from({ length: 250 }, (_, index) => ({
        id: `media-${index}`,
        filename: `media-${index}.png`,
        originalName: `Media ${index}`,
        type: 'image',
        url: `/uploads/media-${index}.png`,
        size: 1024,
      }))
    )

    render(<MediaLibraryModal onClose={vi.fn()} onInsert={vi.fn()} />)

    await waitFor(() => expect(api.getMedia).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())

    expect(screen.getAllByTestId('media-library-item')).toHaveLength(100)
    expect(screen.getByText('Showing 100 of 250 media files')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load more media' })).toBeTruthy()
  })
})
