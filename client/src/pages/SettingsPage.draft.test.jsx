import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'

const initial = { settingsRevision: 0, defaultTheme: 'black', defaultTransition: 'slide', ai: { provider: 'openai', model: 'gpt-4o-mini', apiKey: '***configured***' } }
const reply = (body, status = 200) => ({ ok: status === 200, status, json: async () => body })
const show = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>)
const edit = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(initial))))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Settings confirmed baseline and editable draft', () => {
  it('Audit regression: ignores the aborted StrictMode load while the replacement GET is pending', async () => {
    let resolveLatest
    const latest = { ...initial, settingsRevision: 7, defaultTheme: 'moon' }
    fetch.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('The settings request was aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    })).mockReturnValueOnce(new Promise(resolve => { resolveLatest = resolve }))
      .mockResolvedValueOnce(reply({ ...latest, settingsRevision: 8, defaultTheme: 'white' }))

    render(<StrictMode><MemoryRouter><SettingsPage /></MemoryRouter></StrictMode>)
    await act(async () => {})
    const replacementStillLoading = screen.queryByText('Loading settings...') !== null
    const prematureDraft = screen.queryByLabelText('Default Theme')
    await act(async () => resolveLatest(reply(latest)))

    expect(screen.getByLabelText('Default Theme').value).toBe('moon')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(false)
    expect(replacementStillLoading).toBe(true)
    expect(prematureDraft).toBeNull()
    edit('Default Theme', 'white')
    save()
    await screen.findByText('Settings saved!')
    const mutation = fetch.mock.calls.filter(([, options]) => options?.method === 'PUT').at(-1)[1]
    expect(mutation.headers['If-Match']).toBe('"7"')
    expect(JSON.parse(mutation.body).defaultTheme).toBe('white')
  })

  it('announces actual dirty state after a successful save, edit and revert', async () => {
    fetch.mockResolvedValueOnce(reply(initial)).mockResolvedValueOnce(reply({ ...initial, settingsRevision: 1, defaultTheme: 'white' }))
    show()
    await screen.findByLabelText('Default Theme')
    edit('Default Theme', 'white')
    save()
    const status = () => screen.getByRole('status', { name: 'Settings save status' }).textContent
    await waitFor(() => expect(status()).toBe('Settings saved!'))
    edit('Default Theme', 'moon')
    expect(status()).toMatch(/unsaved changes/i)
    edit('Default Theme', 'white')
    expect(status()).toBe('Settings saved!')
    edit('API Key', 'new-secret')
    expect(status()).toMatch(/unsaved changes/i)
    edit('API Key', '***configured***')
    expect(status()).toBe('Settings saved!')
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)
  })

  it('clears pending-newer dirty status when reverted after the save response', async () => {
    let resolve
    fetch.mockResolvedValueOnce(reply(initial)).mockReturnValueOnce(new Promise(r => { resolve = r }))
    show()
    await screen.findByLabelText('Default Theme')
    edit('Default Theme', 'white')
    save()
    edit('Default Theme', 'moon')
    await act(async () => resolve(reply({ ...initial, settingsRevision: 1, defaultTheme: 'white' })))
    expect(screen.getByRole('status', { name: 'Settings save status' }).textContent).toMatch(/unsaved changes/i)
    edit('Default Theme', 'white')
    expect(screen.getByRole('status', { name: 'Settings save status' }).textContent).toBe('Settings saved!')
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1)
  })

  it('keeps edits entered during Save and persists them on the next Save', async () => {
    let resolve
    const pending = new Promise(r => { resolve = r })
    fetch.mockResolvedValueOnce(reply(initial)).mockReturnValueOnce(pending)
    show()
    await screen.findByLabelText('Default Theme')
    edit('Default Theme', 'white')
    save()
    edit('Default Theme', 'moon')
    await act(async () => resolve(reply({ ...initial, settingsRevision: 1, defaultTheme: 'white' })))
    expect(screen.getByLabelText('Default Theme').value).toBe('moon')
    expect(screen.getByText(/unsaved changes/i)).toBeTruthy()
    fetch.mockResolvedValueOnce(reply({ ...initial, settingsRevision: 2, defaultTheme: 'moon' }))
    save()
    await waitFor(() => expect(screen.getByText(/settings saved/i)).toBeTruthy())
    const mutation = fetch.mock.calls.filter(([, options]) => options?.method === 'PUT').at(-1)[1]
    expect(mutation.headers['If-Match']).toBe('"1"')
    expect(JSON.parse(mutation.body)).toMatchObject({ defaultTheme: 'moon' })
    expect(JSON.parse(mutation.body)).not.toHaveProperty('settingsRevision')
    expect(JSON.parse(mutation.body).ai).not.toHaveProperty('apiKey')
  })

  it('does not replace a newer pending API key with the masked response', async () => {
    let resolve
    fetch.mockResolvedValueOnce(reply(initial)).mockReturnValueOnce(new Promise(r => { resolve = r }))
    show()
    await screen.findByLabelText('API Key')
    edit('API Key', 'local-first')
    save()
    edit('API Key', 'local-second')
    await act(async () => resolve(reply({ ...initial, settingsRevision: 1 })))
    expect(screen.getByLabelText('API Key').value).toBe('local-second')
    expect(screen.getByText(/unsaved changes/i)).toBeTruthy()
  })

  it('Audit regression: preserves the rebased draft indication through edits until an actual save', async () => {
    fetch.mockResolvedValueOnce(reply(initial)).mockResolvedValueOnce(reply({}, 412))
    show()
    await screen.findByLabelText('Default Theme')
    edit('Default Theme', 'white')
    save()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByLabelText('Default Theme').value).toBe('white')
    fetch.mockResolvedValueOnce(reply({ ...initial, settingsRevision: 1, defaultTransition: 'fade' }))
    fireEvent.click(screen.getByRole('button', { name: /review latest/i }))
    fireEvent.click(await screen.findByRole('button', { name: /rebase draft/i }))
    expect(screen.getByLabelText('Default Theme').value).toBe('white')
    expect(screen.getByLabelText('Default Transition').value).toBe('fade')
    const status = () => screen.getByRole('status', { name: 'Settings save status' }).textContent
    expect(status()).toMatch(/draft rebased; save to apply/i)
    edit('Default Transition', 'zoom')
    expect(status()).toMatch(/draft rebased; save to apply/i)
    edit('Default Transition', 'fade')
    expect(status()).toMatch(/draft rebased; save to apply/i)
    fetch.mockResolvedValueOnce(reply({ ...initial, settingsRevision: 2, defaultTheme: 'white', defaultTransition: 'fade' }))
    save()
    await waitFor(() => expect(screen.getByText(/settings saved/i)).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each(['replacement', ''])('requires an explicit secret choice after conflict even when both masks match (%s)', async (key) => {
    fetch.mockResolvedValueOnce(reply(initial)).mockResolvedValueOnce(reply({}, 412))
    show()
    await screen.findByLabelText('API Key')
    edit('API Key', key)
    save()
    await screen.findByRole('alert')
    fetch.mockResolvedValueOnce(reply({ ...initial, settingsRevision: 1, ai: { ...initial.ai, model: 'gpt-4o' } }))
    fireEvent.click(screen.getByRole('button', { name: /review latest/i }))
    const choice = await screen.findByLabelText(/api key conflict/i)
    expect(choice.value).toBe('')
    expect(screen.getByRole('button', { name: /rebase draft/i }).disabled).toBe(true)
    fireEvent.change(choice, { target: { value: 'server' } })
    fireEvent.click(screen.getByRole('button', { name: /rebase draft/i }))
    expect(screen.getByLabelText('API Key').value).toBe('***configured***')
  })

  it.each([false, true])('accepts the masked saved key without a false dirty draft after reverting pending edits: %s', async (revert) => {
    let resolve
    fetch.mockResolvedValueOnce(reply(initial)).mockReturnValueOnce(new Promise(r => { resolve = r }))
    show()
    await screen.findByLabelText('API Key')
    edit('API Key', 'submitted-key')
    save()
    if (revert) {
      edit('API Key', 'temporary-key')
      edit('API Key', 'submitted-key')
    }
    await act(async () => resolve(reply({ ...initial, settingsRevision: 1 })))
    expect(screen.getByLabelText('API Key').value).toBe('***configured***')
    expect(screen.getByRole('status', { name: 'Settings save status' }).textContent).not.toMatch(/unsaved/i)
    save()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(false))
    const next = fetch.mock.calls.filter(([, options]) => options?.method === 'PUT').at(-1)[1]
    expect(next.headers['If-Match']).toBe('"1"')
    expect(JSON.parse(next.body).ai).not.toHaveProperty('apiKey')
  })

  it.each(['http', 'network', 'json'])('preserves an edited draft and allows retry after a %s failure', async (failure) => {
    fetch.mockResolvedValueOnce(reply(initial))
    if (failure === 'network') fetch.mockRejectedValueOnce(new Error('offline'))
    else fetch.mockResolvedValueOnce(failure === 'http' ? reply({}, 500) : {
      ok: true, status: 200, json: async () => { throw new SyntaxError('invalid response') },
    })
    show()
    await screen.findByLabelText('Default Theme')
    edit('Default Theme', 'moon')
    edit('API Key', 'replacement-key')
    save()
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Default Theme').value).toBe('moon')
    expect(screen.getByLabelText('API Key').value).toBe('replacement-key')
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(false)
    fetch.mockResolvedValueOnce(reply({ ...initial, settingsRevision: 1, defaultTheme: 'moon' }))
    save()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    const retried = fetch.mock.calls.filter(([, options]) => options?.method === 'PUT').at(-1)[1]
    expect(retried.headers['If-Match']).toBe('"0"')
    expect(JSON.parse(retried.body)).toMatchObject({ defaultTheme: 'moon', ai: { apiKey: 'replacement-key' } })
    expect(screen.getByLabelText('API Key').value).toBe('***configured***')
  })

  it('prevents a second Save while pending and aborts the pending mutation on unmount', async () => {
    let resolve
    fetch.mockResolvedValueOnce(reply(initial)).mockReturnValueOnce(new Promise(r => { resolve = r }))
    const view = show()
    await screen.findByLabelText('Default Theme')
    edit('Default Theme', 'white')
    save()
    fireEvent.click(screen.getByRole('button', { name: /saving/i }))
    const mutations = fetch.mock.calls.filter(([, options]) => options?.method === 'PUT')
    expect(mutations.map(([, options]) => JSON.parse(options.body).defaultTheme)).toEqual(['white'])
    view.unmount()
    expect(mutations[0][1].signal.aborted).toBe(true)
    await act(async () => resolve(reply({ ...initial, settingsRevision: 1, defaultTheme: 'white' })))
    expect(screen.queryByLabelText('Default Theme')).toBeNull()
  })

  it('does not allow a failed GET to overwrite server settings with defaults', async () => {
    fetch.mockRejectedValueOnce(new Error('offline'))
    show()
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(true)
  })
})
