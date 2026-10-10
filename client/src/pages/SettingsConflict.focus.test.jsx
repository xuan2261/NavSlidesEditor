import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'
import { CONFIGURED_KEY, DEFAULT_SETTINGS } from './settings-draft'

const baseline = { ...DEFAULT_SETTINGS, settingsRevision: 0,
  ai: { ...DEFAULT_SETTINGS.ai, apiKey: CONFIGURED_KEY } }
const reply = (body, status = 200) => ({ ok: status === 200, status, json: async () => body })

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function conflictedSettings(latest) {
  let releaseLatest
  const pendingLatest = new Promise(resolve => { releaseLatest = resolve })
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(reply(baseline))
    .mockResolvedValueOnce(reply({}, 412))
    .mockReturnValueOnce(pendingLatest))
  render(<MemoryRouter><SettingsPage /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('Default Theme'), { target: { value: 'white' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  const review = await screen.findByRole('button', { name: 'Review latest' })
  const user = userEvent.setup()
  review.focus()
  await user.keyboard('{Enter}')
  expect(document.activeElement).toBe(review)
  await act(async () => releaseLatest(reply(latest)))
  return user
}

function expectSettingsFocus() {
  const controls = ['Provider', 'API Key', 'Model', 'Default Theme', 'Default Transition']
    .map(label => screen.getByLabelText(label))
  controls.push(screen.getByRole('button', { name: 'Save' }))
  expect(controls).toContain(document.activeElement)
  expect(document.activeElement.isConnected).toBe(true)
  expect(document.activeElement.disabled).toBe(false)
}

describe('Settings keyboard focus across conflict replacement', () => {
  it.each([true, false])('moves Review latest focus to a usable conflict control after GET (field conflict=%s)', async (hasFieldConflict) => {
    const latest = { ...baseline, settingsRevision: 1, defaultTransition: 'fade',
      defaultTheme: hasFieldConflict ? 'dracula' : 'black' }
    await conflictedSettings(latest)
    const region = screen.getByRole('region', { name: 'Settings conflict' })
    const target = hasFieldConflict
      ? within(region).getByLabelText('defaultTheme conflict')
      : within(region).getByRole('button', { name: 'Rebase draft' })
    expect(document.activeElement).toBe(target)
    expect(target.disabled).toBe(false)
    expect(screen.getByLabelText('Default Theme').value).toBe('white')
  })

  it('moves keyboard Rebase draft focus to a surviving settings control and preserves the rebased data', async () => {
    const user = await conflictedSettings({ ...baseline, settingsRevision: 1,
      defaultTheme: 'dracula', defaultTransition: 'fade' })
    await user.selectOptions(screen.getByLabelText('defaultTheme conflict'), 'local')
    screen.getByRole('button', { name: 'Rebase draft' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('region', { name: 'Settings conflict' })).toBeNull()
    expect(screen.getByLabelText('Default Theme').value).toBe('white')
    expect(screen.getByLabelText('Default Transition').value).toBe('fade')
    expectSettingsFocus()
  })

  it('moves confirmed keyboard reload focus to a surviving settings control after the dialog and opener unmount', async () => {
    const user = await conflictedSettings({ ...baseline, settingsRevision: 1,
      defaultTheme: 'dracula', defaultTransition: 'fade' })
    screen.getByRole('button', { name: 'Reload and discard draft' }).focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: 'Reload latest settings?' })
    within(dialog).getByRole('button', { name: 'Confirm' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Settings conflict' })).toBeNull()
    expect(screen.getByLabelText('Default Theme').value).toBe('dracula')
    expect(screen.getByLabelText('Default Transition').value).toBe('fade')
    expectSettingsFocus()
  })
})
