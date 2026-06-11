import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MediaProperties from './media-properties'

describe('Phase 2: single video source field', () => {
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
})
