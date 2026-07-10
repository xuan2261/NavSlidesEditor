import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import FileBrowserModal from './file-browser-modal-to-select-and-insert-media.jsx'
import { AppFeedbackProvider } from './ui/AppFeedbackProvider.jsx'

const mockFiles = [
  { filename: 'photo.jpg', url: '/uploads/pres-1/photo.jpg', size: 102400, type: 'image/jpeg' },
  { filename: 'video.mp4', url: '/uploads/pres-1/video.mp4', size: 5242880, type: 'video/mp4' },
  { filename: 'audio.mp3', url: '/uploads/pres-1/audio.mp3', size: 2048000, type: 'audio/mpeg' },
]

describe('FileBrowserModal', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockFiles),
    })
  })

  it('renders file browser title', async () => {
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('File Browser')).toBeTruthy()
    })
  })

  it('fetches files on mount', async () => {
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/presentations/pres-1/uploads')
    })
  })

  it('renders all files initially', async () => {
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeTruthy()
      expect(screen.getByText('video.mp4')).toBeTruthy()
      expect(screen.getByText('audio.mp3')).toBeTruthy()
    })
  })

  it('filters by image type', async () => {
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeTruthy()
    })
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'image' } })
    expect(screen.getByText('photo.jpg')).toBeTruthy()
    expect(screen.queryByText('video.mp4')).toBeNull()
    expect(screen.queryByText('audio.mp3')).toBeNull()
  })

  it('calls onClose when backdrop clicked', async () => {
    const onClose = vi.fn()
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('File Browser')).toBeTruthy()
    })
    const backdrop = screen.getByText('File Browser').closest('[class*="fixed"]')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('calls onInsert with correct type for image', async () => {
    const onInsert = vi.fn()
    render(<FileBrowserModal presentationId="pres-1" onInsert={onInsert} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeTruthy()
    })
    const imageCard = screen.getByText('photo.jpg').closest('[class*="cursor"]')
      || screen.getByText('photo.jpg').parentElement
    fireEvent.click(imageCard)
    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'image', src: '/uploads/pres-1/photo.jpg' })
    )
  })

  it('deletes a file from the browser list', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(mockFiles) })
      .mockResolvedValueOnce({ ok: true })
    render(
      <>
        <AppFeedbackProvider />
        <FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />
      </>
    )
    await waitFor(() => {
      expect(screen.getByText('photo.jpg')).toBeTruthy()
    })

    fireEvent.click(screen.getAllByText('Delete')[0])
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete uploaded file' })).getByRole('button', {
        name: 'Delete',
      })
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/presentations/pres-1/uploads/photo.jpg',
        { method: 'DELETE' }
      )
      expect(screen.queryByText('photo.jpg')).toBeNull()
    })
  })

  it('keeps the file browser open when Escape dismisses its nested confirmation', async () => {
    const onClose = vi.fn()
    render(
      <>
        <AppFeedbackProvider />
        <FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={onClose} />
      </>
    )
    await screen.findByText('photo.jpg')

    fireEvent.click(screen.getAllByText('Delete')[0])
    expect(screen.getByRole('dialog', { name: 'Delete uploaded file' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Delete uploaded file' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'File Browser' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('handles empty file list', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
    })
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('File Browser')).toBeTruthy()
    })
  })

  it('handles fetch error gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('File Browser')).toBeTruthy()
    })
  })
})
