import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ShareModal from './ShareModal'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        shares: [{ token: 'abc', name: 'Review Link', views: 2, isProtected: true }],
      }),
    }))
  )
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn() },
  })
})

describe('ShareModal accessibility semantics', () => {
  it('[F9] exposes tabs, tabpanels, and scoped table headers', async () => {
    render(<ShareModal presentationId="deck-1" onClose={vi.fn()} />)

    expect(screen.getByRole('tablist', { name: 'Share options' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Links/i }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: /Embed/i }).getAttribute('aria-controls')).toBe(
      'share-panel-embed'
    )

    await waitFor(() => expect(screen.getByText('Review Link')).toBeTruthy())

    expect(screen.getByRole('tabpanel', { name: /Links/i })).toBeTruthy()
    expect(
      screen.getByRole('columnheader', { name: 'Password protected' }).getAttribute('scope')
    ).toBe('col')
    expect(screen.getByRole('columnheader', { name: 'Actions' }).getAttribute('scope')).toBe('col')
  })
})
