import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

const mocks = vi.hoisted(() => ({
  api: {
    getPresentations: vi.fn(),
    getTemplates: vi.fn(),
    getTrash: vi.fn(),
    getSettings: vi.fn(() => Promise.resolve({})),
    preflightProjectImport: vi.fn(),
    stageProjectImportMedia: vi.fn(),
    publishProjectImport: vi.fn(),
    rollbackProjectImport: vi.fn(),
  },
  showError: vi.fn(),
}))

vi.mock('../utils/api', () => ({ api: mocks.api }))
vi.mock('../utils/app-feedback', () => ({
  showError: mocks.showError,
  showNotice: vi.fn(),
}))
vi.mock('../components/dashboard/TemplatePreview', () => ({ default: () => null }))
vi.mock('../components/SlideThumbnail', () => ({ default: () => <div /> }))
vi.mock('revealjs-shared', async (importOriginal) => ({
  ...(await importOriginal()),
  SUPPORTED_REVEAL_THEMES: ['black'],
  getDesignTokensForRevealTheme: vi.fn(() => ({})),
  getThemePreset: vi.fn(() => null),
}))

function renderHome(onOpen = vi.fn()) {
  return {
    onOpen,
    ...render(<MemoryRouter><HomePage onOpen={onOpen} theme="light" onToggleTheme={vi.fn()} /></MemoryRouter>),
  }
}

describe('HomePage atomic project import lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.api.getPresentations.mockResolvedValue([])
    mocks.api.getTemplates.mockResolvedValue([])
    mocks.api.getTrash.mockResolvedValue([])
    mocks.api.stageProjectImportMedia.mockResolvedValue({ placed: 0 })
    mocks.api.rollbackProjectImport.mockResolvedValue({ status: 'rolled-back' })
  })

  function projectInput() {
    return document.querySelector('input[accept=".navslides,.json"]')
  }

  it('opens only the server-published presentation and never calls generic create', async () => {
    mocks.api.preflightProjectImport.mockResolvedValue({
      sessionId: 'session-1', capability: 'cap', mediaCount: 0,
    })
    mocks.api.publishProjectImport.mockResolvedValue({
      status: 'committed', presentationId: 'deck-1',
    })
    const { onOpen } = renderHome()
    await screen.findByText('Import Project')
    fireEvent.change(projectInput(), {
      target: { files: [new File(['PK'], 'deck.navslides')] },
    })
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith('deck-1'))
    expect(mocks.api.createPresentation).toBeUndefined()
  })

  it('rolls back a pending session on unmount but not after publish starts', async () => {
    let resolveMedia
    mocks.api.preflightProjectImport.mockResolvedValue({
      sessionId: 'session-pending', capability: 'cap', mediaCount: 1,
    })
    mocks.api.stageProjectImportMedia.mockImplementation(() => new Promise((resolve) => {
      resolveMedia = resolve
    }))
    const pending = renderHome()
    await screen.findByText('Import Project')
    fireEvent.change(projectInput(), {
      target: { files: [new File(['PK'], 'deck.navslides')] },
    })
    await waitFor(() => expect(mocks.api.stageProjectImportMedia).toHaveBeenCalled())
    pending.unmount()
    await waitFor(() => expect(mocks.api.rollbackProjectImport).toHaveBeenCalledWith(
      'session-pending', 'cap'
    ))
    resolveMedia({ placed: 1 })
  })
})
