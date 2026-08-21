import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AnalyticsModal from './AnalyticsModal'

vi.mock('../components/ui', () => ({
  ModalShell: ({ children }) => <div>{children}</div>,
}))

describe('AnalyticsModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads owner analytics without acquiring or sending a share capability', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ totalViews: 0, dailyViews: [], byLinkLabels: {}, recentEvents: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AnalyticsModal presentationId="deck-1" onClose={() => {}} />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/analytics/deck-1')
  })

  it('renders redacted link labels and recent referrer hosts without share tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        totalViews: 4,
        dailyViews: [{ date: '2026-08-20', count: 4 }],
        byLinkLabels: { 'Campaign Alpha': 4 },
        recentEvents: [
          {
            timestamp: '2026-08-20T05:00:00.000Z',
            referrerHost: 'example.com',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AnalyticsModal presentationId="deck-1" onClose={() => {}} />)

    expect(await screen.findByText('Campaign Alpha')).toBeTruthy()
    expect(screen.getByText('example.com')).toBeTruthy()
    expect(screen.queryByText(/token/i)).toBeNull()
  })
})
