import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MediaLibraryModal from './MediaLibraryModal'

const feedback = vi.hoisted(() => ({ confirmUser: vi.fn() }))

vi.mock('../utils/api', () => ({
  api: {
    getMedia: vi.fn(),
    uploadFile: vi.fn(),
    deleteMedia: vi.fn(),
  },
}))

vi.mock('../utils/app-feedback', () => ({ confirmUser: feedback.confirmUser }))

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

  it('supports keyboard insert and delete with sibling buttons', async () => {
    const user = userEvent.setup()
    const item = {
      id: 'media-1',
      filename: 'diagram.png',
      originalName: 'Diagram',
      type: 'image',
      url: '/uploads/diagram.png',
      size: 1024,
    }
    const onInsert = vi.fn()
    api.getMedia.mockResolvedValue([item])
    api.deleteMedia.mockResolvedValue({ success: true })
    feedback.confirmUser.mockImplementation((_message, onConfirm) => onConfirm())

    render(<MediaLibraryModal onClose={vi.fn()} onInsert={onInsert} />)
    const insert = await screen.findByRole('button', { name: 'Insert Diagram' })
    const remove = screen.getByRole('button', { name: 'Delete Diagram' })
    expect(insert.contains(remove)).toBe(false)
    insert.focus()
    await user.tab()
    expect(document.activeElement).toBe(remove)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(insert)
    await user.keyboard('{Enter}')
    expect(onInsert).toHaveBeenCalledWith(item)

    remove.focus()
    await user.keyboard(' ')
    await waitFor(() => expect(api.deleteMedia).toHaveBeenCalledWith('diagram.png'))
  })
})
