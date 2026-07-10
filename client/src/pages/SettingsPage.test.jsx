import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import { testAIConnection } from '../utils/ai'

vi.mock('../utils/ai', () => ({ testAIConnection: vi.fn() }))

describe('SettingsPage accessibility and AI connection test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai: { provider: 'openai', apiKey: '', model: 'gpt-4o-mini' },
      }),
    })
  })

  it('tests the current unsaved AI fields and exposes an accessible live result', async () => {
    testAIConnection.mockResolvedValue(true)
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    const apiKey = await screen.findByLabelText('API Key')
    fireEvent.change(apiKey, { target: { value: 'unsaved-key' } })
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'gpt-4o' } })
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }))

    await waitFor(() => {
      expect(testAIConnection).toHaveBeenCalledWith({
        provider: 'openai',
        apiKey: 'unsaved-key',
        model: 'gpt-4o',
        customEndpoint: '',
        customModel: '',
      })
    })
    expect(screen.getByRole('status').textContent).toContain('Connected')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('associates custom provider labels and gives shortcut actions focus visibility', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )
    fireEvent.change(await screen.findByLabelText('Provider'), { target: { value: 'custom' } })

    expect(screen.getByLabelText('Endpoint URL')).toBeTruthy()
    expect(screen.getByLabelText('Model Name')).toBeTruthy()

    const edit = screen.getAllByRole('button', { name: /^Edit / })[0]
    expect(edit.className).toContain('group-focus-within:opacity-100')
  })

  it('cancels shortcut recording before opening Sync so Escape reaches the modal', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    await screen.findByLabelText('Provider')
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit / })[0])
    expect(screen.getByText(/Recording shortcut/)).toBeTruthy()

    fireEvent.click(screen.getByTestId('settings-open-sync'))

    expect(screen.queryByText(/Recording shortcut/)).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Sync to Cloud' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Sync to Cloud' })).toBeNull()
  })
})
