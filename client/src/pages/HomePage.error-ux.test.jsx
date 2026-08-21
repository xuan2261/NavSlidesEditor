import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

const mocks = vi.hoisted(() => ({
  getPresentations: vi.fn(),
  getTemplates: vi.fn(),
  getTrash: vi.fn(),
  getSettings: vi.fn(() => Promise.resolve({})),
  duplicatePresentation: vi.fn(),
  deletePresentation: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('../utils/api', () => ({
  api: {
    getPresentations: mocks.getPresentations,
    getTemplates: mocks.getTemplates,
    getTrash: mocks.getTrash,
    getSettings: mocks.getSettings,
    duplicatePresentation: mocks.duplicatePresentation,
    deletePresentation: mocks.deletePresentation,
  },
}))

vi.mock('../utils/app-feedback', () => ({
  showError: mocks.showError,
  showNotice: vi.fn(),
}))

vi.mock('../components/dashboard/TemplatePreview', () => ({ default: () => null }))
vi.mock('../components/SlideThumbnail', () => ({ default: () => <div data-testid="thumbnail" /> }))
vi.mock('revealjs-shared', () => ({
  SUPPORTED_REVEAL_THEMES: ['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized', 'blood', 'moon', 'dracula'],
  getDesignTokensForRevealTheme: vi.fn(() => ({})),
  getThemePreset: vi.fn(() => null),
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage onOpen={vi.fn()} theme="light" onToggleTheme={vi.fn()} />
    </MemoryRouter>
  )
}

describe('HomePage data failure UX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getTemplates.mockResolvedValue([])
    mocks.getTrash.mockResolvedValue([])
  })

  it('shows an accessible initial-load error with retry instead of the empty dashboard', async () => {
    mocks.getPresentations.mockRejectedValueOnce(new Error('offline'))
    renderHome()

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load dashboard data/i)
    expect(screen.getByRole('button', { name: /retry loading dashboard/i })).toBeTruthy()
    expect(screen.queryByText('Welcome to NavSlides Editor')).toBeNull()
  })

  it('retries initial loading and renders data after recovery', async () => {
    mocks.getPresentations
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ id: 'deck-1', title: 'Recovered deck', slideCount: 1 }])
    renderHome()

    fireEvent.click(await screen.findByRole('button', { name: /retry loading dashboard/i }))

    expect(await screen.findByText('Recovered deck')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('preserves existing dashboard data when a post-mutation reload fails', async () => {
    mocks.getPresentations
      .mockResolvedValueOnce([{ id: 'deck-1', title: 'Keep this deck', slideCount: 1 }])
      .mockRejectedValueOnce(new Error('reload failed'))
    mocks.duplicatePresentation.mockResolvedValue({})
    renderHome()

    await screen.findByText('Keep this deck')
    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicate' })[0])

    await waitFor(() => expect(mocks.getPresentations).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Keep this deck')).toBeTruthy()
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /could not refresh dashboard data/i
    )
  })

  it('surfaces mutation failures through app feedback', async () => {
    mocks.getPresentations.mockResolvedValue([
      { id: 'deck-1', title: 'Mutation deck', slideCount: 1 },
    ])
    mocks.duplicatePresentation.mockRejectedValue(new Error('duplicate failed'))
    renderHome()

    await screen.findByText('Mutation deck')
    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicate' })[0])

    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith(
        expect.stringMatching(/failed to duplicate presentation/i)
      )
    )
  })

  it('keeps destructive delete failures visible and leaves the deck intact', async () => {
    mocks.getPresentations.mockResolvedValue([
      { id: 'deck-1', title: 'Safe deck', slideCount: 1 },
    ])
    mocks.deletePresentation.mockRejectedValue(new Error('delete failed'))
    renderHome()

    await screen.findByText('Safe deck')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(mocks.showError).toHaveBeenCalledWith(
        expect.stringMatching(/failed to move presentation to trash/i)
      )
    )
    expect(screen.getByText('Safe deck')).toBeTruthy()
  })
})
