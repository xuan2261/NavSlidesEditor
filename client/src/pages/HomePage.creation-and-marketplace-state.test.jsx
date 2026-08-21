import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

const h = vi.hoisted(() => ({
  createPresentation: vi.fn(),
  getMarketplaceTemplates: vi.fn(),
  getPresentations: vi.fn(),
  getSettings: vi.fn(),
  getTemplates: vi.fn(),
  getTrash: vi.fn(),
}))

vi.mock('../utils/api', () => ({
  api: {
    createPresentation: h.createPresentation,
    getMarketplaceTemplates: h.getMarketplaceTemplates,
    getPresentations: h.getPresentations,
    getSettings: h.getSettings,
    getTemplates: h.getTemplates,
    getTrash: h.getTrash,
  },
}))

vi.mock('../utils/app-feedback', () => ({ showError: vi.fn(), showNotice: vi.fn() }))
vi.mock('../components/dashboard/TemplatePreview', () => ({ default: () => null }))
vi.mock('../components/SlideThumbnail', () => ({ default: () => <div data-testid="thumbnail" /> }))
vi.mock('revealjs-shared', () => ({
  SUPPORTED_REVEAL_THEMES: ['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized', 'blood', 'moon', 'dracula'],
  getDesignTokensForRevealTheme: vi.fn(() => ({})),
  getThemePreset: vi.fn(() => null),
}))

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage onOpen={vi.fn()} theme="light" onToggleTheme={vi.fn()} />
    </MemoryRouter>
  )
}

describe('HomePage creation defaults and marketplace states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getPresentations.mockResolvedValue([])
    h.getTemplates.mockResolvedValue([])
    h.getTrash.mockResolvedValue([])
    h.getSettings.mockResolvedValue({ defaultTheme: 'moon', defaultTransition: 'fade' })
  })

  it('applies saved defaults whenever a fresh create dialog opens', async () => {
    renderHome()
    await screen.findByText('Welcome to NavSlides Editor')
    await waitFor(() => expect(h.getSettings).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'New presentation' }))

    expect(screen.getByLabelText('Theme').value).toBe('moon')
    expect(screen.getByLabelText('Transition').value).toBe('fade')
  })

  it('does not overwrite create-form edits made while settings are loading', async () => {
    const pendingSettings = deferred()
    h.getSettings.mockReturnValueOnce(pendingSettings.promise)
    renderHome()
    await screen.findByText('Welcome to NavSlides Editor')

    fireEvent.click(screen.getByRole('button', { name: 'New presentation' }))
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'white' } })

    pendingSettings.resolve({ defaultTheme: 'moon', defaultTransition: 'fade' })
    await waitFor(() => expect(h.getSettings).toHaveBeenCalledTimes(1))

    expect(screen.getByLabelText('Theme').value).toBe('white')
    expect(screen.getByLabelText('Transition').value).toBe('slide')
  })

  it('separates marketplace error, retry, and successful-empty states', async () => {
    h.getMarketplaceTemplates
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ categories: [], templates: [] })
    renderHome()
    await screen.findByText('Welcome to NavSlides Editor')

    fireEvent.click(screen.getByRole('button', { name: 'Marketplace' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load marketplace templates/i)

    fireEvent.click(screen.getByRole('button', { name: /retry loading marketplace/i }))
    expect(await screen.findByText('No marketplace templates available.')).toBeTruthy()
    expect(h.getMarketplaceTemplates).toHaveBeenCalledTimes(2)
  })
})
