import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { QrCodeRenderer } from './qrcode-element-renderer'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}))

describe('QR code element renderer', () => {
  beforeEach(() => {
    QRCode.toDataURL.mockReset()
  })

  it('clears stale images and shows an error when generation rejects', async () => {
    QRCode.toDataURL.mockResolvedValueOnce('data:image/png;base64,old')
    const { rerender } = render(<QrCodeRenderer element={{ qrData: 'old' }} />)
    expect((await screen.findByAltText('QR Code')).getAttribute('src')).toBe('data:image/png;base64,old')

    QRCode.toDataURL.mockRejectedValueOnce(new Error('bad qr'))
    rerender(<QrCodeRenderer element={{ qrData: 'bad' }} />)

    await waitFor(() => expect(screen.queryByAltText('QR Code')).toBeNull())
    expect(screen.getByText('QR code unavailable')).toBeTruthy()
  })

  it('ignores stale out-of-order QR promise results', async () => {
    let resolveFirst
    QRCode.toDataURL
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce('data:image/png;base64,new')

    const { rerender } = render(<QrCodeRenderer element={{ qrData: 'first' }} />)
    rerender(<QrCodeRenderer element={{ qrData: 'second' }} />)

    expect((await screen.findByAltText('QR Code')).getAttribute('src')).toBe('data:image/png;base64,new')
    resolveFirst('data:image/png;base64,old')
    await waitFor(() => expect(screen.getByAltText('QR Code').getAttribute('src')).toBe('data:image/png;base64,new'))
  })
})
