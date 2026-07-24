import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'

const mocks = vi.hoisted(() => ({
  getPresentations: vi.fn(),
  getTemplates: vi.fn(),
  getTrash: vi.fn(),
  importPptxAsync: vi.fn(),
  cancelPptxJob: vi.fn(),
  waitForPptxJob: vi.fn(),
  showError: vi.fn(),
  showNotice: vi.fn(),
}))

vi.mock('../utils/api', () => ({
  api: {
    getPresentations: mocks.getPresentations,
    getTemplates: mocks.getTemplates,
    getTrash: mocks.getTrash,
    importPptxAsync: mocks.importPptxAsync,
    cancelPptxJob: mocks.cancelPptxJob,
  },
}))
vi.mock('../utils/pptx-job-wait', () => ({ waitForPptxJob: mocks.waitForPptxJob }))
vi.mock('../utils/app-feedback', () => ({
  showError: mocks.showError,
  showNotice: mocks.showNotice,
}))
vi.mock('../components/dashboard/TemplatePreview', () => ({ default: () => null }))
vi.mock('../components/SlideThumbnail', () => ({ default: () => <div /> }))
vi.mock('revealjs-shared', () => ({
  getDesignTokensForRevealTheme: vi.fn(() => ({})),
  getThemePreset: vi.fn(() => null),
}))

function renderHome(onOpen = vi.fn()) {
  return {
    onOpen,
    ...render(
      <MemoryRouter>
        <HomePage onOpen={onOpen} theme="light" onToggleTheme={vi.fn()} />
      </MemoryRouter>
    ),
  }
}

describe('HomePage PPTX import admission lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPresentations.mockResolvedValue([])
    mocks.getTemplates.mockResolvedValue([])
    mocks.getTrash.mockResolvedValue([])
    mocks.cancelPptxJob.mockResolvedValue({ status: 'cancelling' })
  })

  it('aborts an admission wait on unmount without reporting an import failure', async () => {
    let admissionSignal
    mocks.importPptxAsync.mockImplementation((_file, { signal }) => new Promise((_resolve, reject) => {
      admissionSignal = signal
      signal?.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    }))

    const { unmount } = renderHome()
    const input = await screen.findByTestId('home-import-pptx-input')
    fireEvent.change(input, { target: { files: [new File(['pptx'], 'deck.pptx')] } })

    await waitFor(() => expect(mocks.importPptxAsync).toHaveBeenCalledTimes(1))
    expect(admissionSignal).toBeDefined()

    unmount()
    expect(admissionSignal.aborted).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.waitForPptxJob).not.toHaveBeenCalled()
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('does not admit an overlapping import or replace its unmount cleanup', async () => {
    const admissionSignals = []
    mocks.importPptxAsync.mockImplementation((_file, { signal }) => new Promise((_resolve, reject) => {
      admissionSignals.push(signal)
      signal?.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    }))

    const { unmount } = renderHome()
    const input = await screen.findByTestId('home-import-pptx-input')
    fireEvent.change(input, { target: { files: [new File(['pptx'], 'first.pptx')] } })
    await waitFor(() => expect(mocks.importPptxAsync).toHaveBeenCalledTimes(1))

    fireEvent.change(input, { target: { files: [new File(['pptx'], 'second.pptx')] } })
    expect(mocks.importPptxAsync).toHaveBeenCalledTimes(1)
    expect(admissionSignals).toHaveLength(1)

    unmount()
    expect(admissionSignals[0].aborted).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.waitForPptxJob).not.toHaveBeenCalled()
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('passes the same AbortController signal from admission into waitForPptxJob', async () => {
    let admissionSignal
    mocks.importPptxAsync.mockImplementation((_file, { signal }) => {
      admissionSignal = signal
      return Promise.resolve({ jobId: 'job-shared-signal' })
    })
    mocks.waitForPptxJob.mockResolvedValue({ presentationId: 'deck-1' })

    renderHome()
    const input = await screen.findByTestId('home-import-pptx-input')
    fireEvent.change(input, { target: { files: [new File(['pptx'], 'deck.pptx')] } })

    await waitFor(() => expect(mocks.waitForPptxJob).toHaveBeenCalledTimes(1))
    const waitArgs = mocks.waitForPptxJob.mock.calls[0][0]
    expect(waitArgs.signal).toBe(admissionSignal)
    expect(waitArgs.jobId).toBe('job-shared-signal')
  })

  it('does not onOpen or toast failure when wait resolves after unmount', async () => {
    let resolveWait
    mocks.importPptxAsync.mockResolvedValue({ jobId: 'job-late' })
    mocks.waitForPptxJob.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWait = resolve
        })
    )

    const { onOpen, unmount } = renderHome()
    const input = await screen.findByTestId('home-import-pptx-input')
    fireEvent.change(input, { target: { files: [new File(['pptx'], 'deck.pptx')] } })

    await waitFor(() => expect(mocks.waitForPptxJob).toHaveBeenCalledTimes(1))
    unmount()

    resolveWait({ presentationId: 'deck-late' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onOpen).not.toHaveBeenCalled()
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('does not toast intentional cancelled wait outcomes as import failures', async () => {
    mocks.importPptxAsync.mockResolvedValue({ jobId: 'job-cancel' })
    mocks.waitForPptxJob.mockRejectedValue(
      Object.assign(new Error('PPTX import cancelled'), {
        name: 'PptxJobOutcomeError',
        status: 'cancelled',
      })
    )

    renderHome()
    const input = await screen.findByTestId('home-import-pptx-input')
    fireEvent.change(input, { target: { files: [new File(['pptx'], 'deck.pptx')] } })

    await waitFor(() => expect(mocks.waitForPptxJob).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.showError).not.toHaveBeenCalled()
  })
})
