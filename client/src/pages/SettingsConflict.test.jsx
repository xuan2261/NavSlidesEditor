import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'

const baseline = {
  settingsRevision: 0, defaultTheme: 'black', defaultTransition: 'slide',
  ai: { provider: 'openai', model: 'gpt-4o-mini', apiKey: '***configured***' },
}
const reply = (body, status = 200) => ({ ok: status === 200, status, json: async () => body })
let previousShortcuts
beforeEach(() => {
  previousShortcuts = localStorage.getItem('navslides-shortcuts')
  localStorage.removeItem('navslides-shortcuts')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (previousShortcuts === null) localStorage.removeItem('navslides-shortcuts')
  else localStorage.setItem('navslides-shortcuts', previousShortcuts)
})

describe('Settings conflict discard confirmation', () => {
  it.each(['Escape', 'Tab then Escape'])('Audit regression: discard dialog owns %s instead of the active shortcut recorder', async (keys) => {
    const user = userEvent.setup()
    const latest = { ...baseline, settingsRevision: 1, defaultTheme: 'dracula' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(reply(baseline))
      .mockResolvedValueOnce(reply({}, 412))
      .mockResolvedValueOnce(reply(latest)))
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Default Theme'), { target: { value: 'white' } })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'synthetic-local-draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: /review latest/i }))
    const reload = await screen.findByRole('button', { name: /reload and discard draft/i })
    const shortcutEdit = screen.getAllByRole('button', { name: /^Edit / })[0]
    const shortcutName = shortcutEdit.getAttribute('aria-label')
    const shortcutRow = shortcutEdit.parentElement.parentElement
    const originalChord = shortcutRow.querySelector('kbd').textContent
    fireEvent.click(shortcutEdit)
    expect(screen.getByText(/Recording shortcut/)).toBeTruthy()
    reload.focus()
    fireEvent.click(reload)
    const dialog = await screen.findByRole('dialog', { name: 'Reload latest settings?' })

    if (keys === 'Tab then Escape') {
      within(dialog).getByRole('button', { name: 'Confirm' }).focus()
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
      expect(shortcutRow.querySelector('kbd')?.textContent).toBe(originalChord)
      expect(localStorage.getItem('navslides-shortcuts')).toBeNull()
    }
    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Default Theme').value).toBe('white')
    expect(screen.getByLabelText('API Key').value).toBe('synthetic-local-draft')
    expect(screen.getByRole('region', { name: 'Settings conflict' })).toBeTruthy()
    expect(screen.getByRole('button', { name: shortcutName })).toBeTruthy()
    expect(shortcutRow.querySelector('kbd').textContent).toBe(originalChord)
    expect(localStorage.getItem('navslides-shortcuts')).toBeNull()
    expect(document.activeElement).toBe(reload)
  })

  it.each([
    ['Default Theme', 'moon', 'dracula'],
    ['API Key', 'synthetic-new-key', '***configured***'],
  ])('Audit regression: editing %s after confirmed reload announces unsaved changes', async (label, edited, restored) => {
    const latest = { ...baseline, settingsRevision: 1, defaultTheme: 'dracula' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(reply(baseline))
      .mockResolvedValueOnce(reply({}, 412))
      .mockResolvedValueOnce(reply(latest)))
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Default Theme'), { target: { value: 'white' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: /review latest/i }))
    fireEvent.click(await screen.findByRole('button', { name: /reload and discard draft/i }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    const status = () => screen.queryByRole('status', { name: 'Settings save status' })?.textContent || ''
    expect(status()).toBe('Latest settings loaded.')
    fireEvent.change(screen.getByLabelText(label), { target: { value: edited } })
    expect(status()).toMatch(/unsaved changes/i)
    fireEvent.change(screen.getByLabelText(label), { target: { value: restored } })
    expect(status()).not.toMatch(/unsaved changes/i)
    expect(status()).not.toMatch(/settings saved/i)
    fireEvent.change(screen.getByLabelText(label), { target: { value: edited } })
    fetch.mockResolvedValueOnce(reply({ ...latest, settingsRevision: 2,
      ...(label === 'Default Theme' ? { defaultTheme: edited } : {}),
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Settings saved!')
    fireEvent.change(screen.getByLabelText(label), { target: { value: label === 'Default Theme' ? 'white' : 'temporary-key' } })
    expect(status()).toMatch(/unsaved changes/i)
    fireEvent.change(screen.getByLabelText(label), { target: { value: label === 'Default Theme' ? edited : '***configured***' } })
    expect(status()).toBe('Settings saved!')
  })

  it('keeps the draft on cancellation and adopts the latest baseline only after confirmation', async () => {
    const latest = { ...baseline, settingsRevision: 1, defaultTheme: 'dracula', defaultTransition: 'fade' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(reply(baseline))
      .mockResolvedValueOnce(reply({}, 412))
      .mockResolvedValueOnce(reply(latest)))
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Default Theme'), { target: { value: 'white' } })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'synthetic-local-draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: /review latest/i }))
    const reload = await screen.findByRole('button', { name: /reload and discard draft/i })
    reload.focus()
    fireEvent.click(reload)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Default Theme').value).toBe('white')
    expect(screen.getByLabelText('API Key').value).toBe('synthetic-local-draft')
    expect(document.activeElement).toBe(reload)

    fireEvent.click(reload)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirm' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Default Theme').value).toBe('dracula')
    expect(screen.getByLabelText('Default Transition').value).toBe('fade')
    expect(screen.getByLabelText('API Key').value).toBe('***configured***')
    expect(screen.queryByRole('region', { name: 'Settings conflict' })).toBeNull()

    fetch.mockResolvedValueOnce(reply({ ...latest, settingsRevision: 2, defaultTheme: 'moon' }))
    fireEvent.change(screen.getByLabelText('Default Theme'), { target: { value: 'moon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Settings saved!')
    const mutation = fetch.mock.calls.filter(([, options]) => options?.method === 'PUT').at(-1)[1]
    expect(mutation.headers['If-Match']).toBe('"1"')
    expect(JSON.parse(mutation.body)).toMatchObject({ defaultTheme: 'moon', defaultTransition: 'fade' })
    expect(JSON.parse(mutation.body).ai).not.toHaveProperty('apiKey')
  })
})
