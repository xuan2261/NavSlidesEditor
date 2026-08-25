import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  downloadHTML: vi.fn(),
  exportPDF: vi.fn(),
  presentInWindow: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('revealjs-shared', () => ({
  downloadHTML: h.downloadHTML,
  exportPDF: h.exportPDF,
  presentInWindow: h.presentInWindow,
  generateRevealHTML: vi.fn(),
  getBackgroundAttrs: vi.fn(),
  escapeHtml: vi.fn(),
}))
vi.mock('./app-feedback', () => ({ showError: h.showError }))

import { downloadHTML, exportPDF, presentInWindow } from './generateHTML'

beforeEach(() => {
  Object.values(h).forEach((mock) => mock.mockReset())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('generateHTML client feedback boundary', () => {
  it.each([
    ['HTML export failed', downloadHTML, h.downloadHTML],
    ['PDF export failed', exportPDF, h.exportPDF],
    ['Failed to present', presentInWindow, h.presentInWindow],
  ])('routes %s errors to themed feedback without a native dialog', (label, operation, sharedOperation) => {
    sharedOperation.mockImplementationOnce(() => {
      throw new Error('blocked')
    })

    expect(() => operation({ id: 'deck-1' })).not.toThrow()
    expect(h.showError).toHaveBeenCalledWith(`${label}: blocked`)
  })
})
