import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MediaProperties from './media-properties'

describe('Phase 2: single video source field', () => {
  it('offers the same controls visibility setting for audio', () => {
    const onUpdate = vi.fn()
    render(
      <MediaProperties
        element={{ id: 'a1', type: 'audio', src: '/audio.mp3', controls: false }}
        onUpdate={onUpdate}
      />
    )

    const controls = screen.getByRole('checkbox', { name: 'Show controls' })
    expect(controls.checked).toBe(false)
    fireEvent.click(controls)
    expect(onUpdate).toHaveBeenCalledWith({ controls: true })
  })

  it('renders exactly ONE source field (no separate Video URL)', () => {
    render(
      <MediaProperties
        element={{ id: 'v1', type: 'video', src: 'https://x.com/a.mp4' }}
        onUpdate={vi.fn()}
      />
    )
    // The dual "Video URL" label must be gone
    expect(screen.queryByText('Video URL')).toBeNull()
    // The single Source URL field remains
    expect(screen.getByText('Source URL')).toBeTruthy()
  })

  it('writes source edits to canonical src only', () => {
    const onUpdate = vi.fn()
    render(
      <MediaProperties
        element={{
          id: 'v1',
          type: 'video',
          src: 'https://cdn.example.com/current.mp4',
          videoUrl: 'https://cdn.example.com/legacy.mp4',
        }}
        onUpdate={onUpdate}
      />
    )

    fireEvent.change(screen.getByDisplayValue('https://cdn.example.com/current.mp4'), {
      target: { value: 'https://cdn.example.com/new.mp4' },
    })

    expect(onUpdate).toHaveBeenCalledWith({ src: 'https://cdn.example.com/new.mp4' })
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ videoUrl: expect.anything() }))
  })

  it('shows a legacy videoUrl when canonical src is absent without deleting it', () => {
    const onUpdate = vi.fn()
    render(
      <MediaProperties
        element={{ id: 'v1', type: 'video', videoUrl: 'https://legacy.example.com/old.mp4' }}
        onUpdate={onUpdate}
      />
    )

    const source = screen.getByDisplayValue('https://legacy.example.com/old.mp4')
    fireEvent.change(source, { target: { value: 'https://cdn.example.com/new.mp4' } })

    expect(onUpdate).toHaveBeenCalledWith({ src: 'https://cdn.example.com/new.mp4' })
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ videoUrl: expect.anything() }))
  })

  it('writes an explicit source clear without mutating legacy videoUrl', () => {
    const onUpdate = vi.fn()
    render(
      <MediaProperties
        element={{ id: 'v1', type: 'video', src: 'https://current.example.com/current.mp4', videoUrl: 'https://legacy.example.com/old.mp4' }}
        onUpdate={onUpdate}
      />
    )

    const source = screen.getAllByRole('textbox')[0]
    expect(source.value).toBe('https://current.example.com/current.mp4')
    fireEvent.change(source, { target: { value: '' } })

    expect(onUpdate).toHaveBeenCalledWith({ src: '' })
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ videoUrl: expect.anything() }))
  })
})
