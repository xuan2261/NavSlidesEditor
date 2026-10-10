import { createRequire } from 'node:module'
import path from 'node:path'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorModals from '../../components/EditorModals'
import { AppFeedbackProvider } from '../../components/ui/AppFeedbackProvider'
import { usePresentationStore } from '../../stores/presentation-store'
import { useUIStore } from '../../stores/ui-store'
import { api } from '../../utils/api'
import { readEditorDraft } from '../../utils/editor-draft-store'
import { useEditorHistoryController } from './use-editor-history-controller'
import { useEditorPersistenceController } from './use-editor-persistence-controller'

const require = createRequire(path.resolve(process.cwd(), 'server/routes/history.js'))
const express = require('express')
const request = require('supertest')
const storage = require('../services/storage')
let app, current, held, release, finished, restoreFinished, requests, deckId
const deferred = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

function Harness() {
  const [presentation, setPresentation] = useState(null)
  const currentSlideIndexRef = useRef(0)
  const verticalEditRef = useRef(null)
  const selectedElementIdsRef = useRef([])
  const editingElementIdRef = useRef(null)
  const noop = useCallback(() => {}, [])
  const history = useEditorHistoryController({
    presentation, setPresentation, currentSlideIndexRef, verticalEditRef,
    selectedElementIdsRef, editingElementIdRef, setCurrentSlideIndex: noop,
    setVerticalEdit: noop, setSelectedElementIds: noop, setEditingElementId: noop,
    resetContent: noop,
  })
  const persistence = useEditorPersistenceController({
    presentation, setPresentation, presentationId: deckId, isTemplate: false,
    setGridSize: noop, resetEditorInteraction: noop, seedHistory: history.seedHistory,
  })
  useLayoutEffect(() => { current = { presentation, setPresentation, history, persistence } })
  return <>
    <output aria-label="Editor title">{presentation?.title}</output>
    <EditorModals presentationId={deckId} presentation={presentation}
      currentSlideIndex={0} viewMode="normal" restorePresentation={persistence.restorePresentation} />
    <AppFeedbackProvider />
  </>
}

beforeAll(() => {
  // The existing Vitest storage setup owns these temporary roots and cleanup.
  if (!process.env.NAVSLIDES_VITEST_STORAGE_OWNED || storage.DATA_DIR !== process.env.SLIDES_DATA_DIR) {
    throw new Error('Restore integration requires the isolated Vitest storage root')
  }
  storage.initDataFiles()
  app = express()
  app.use(express.json())
  app.use(async (req, _res, next) => {
    if (req.method === 'PUT' && req.body?.title === 'Outstanding A') {
      held.resolve()
      await release.promise
    }
    next()
  })
  app.use('/api/presentations', require('./presentations-crud'))
  app.use('/api/presentations', require('./history'))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }))
})

beforeEach(async () => {
  held = deferred(); release = deferred(); finished = deferred(); restoreFinished = deferred(); requests = []
  vi.stubGlobal('indexedDB', undefined)
  localStorage.clear()
  usePresentationStore.setState({ presentation: null, saveConflict: null })
  useUIStore.setState({ showHistoryModal: false })
  // Adapt the real client API to real loopback HTTP and production routes, not API echoes.
  vi.stubGlobal('fetch', async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', keepalive: options.keepalive })
    let transport = request(app)[(options.method || 'GET').toLowerCase()](url)
    if (options.headers) transport = transport.set(options.headers)
    if (options.body) transport = transport.send(options.body)
    const response = await transport
    if (options.method === 'PUT' && JSON.parse(options.body).title === 'Outstanding A') finished.resolve(response.status)
    if (/\/restore\//.test(url)) restoreFinished.resolve(response.status)
    return { ok: response.status >= 200 && response.status < 300, status: response.status,
      headers: { get: name => response.headers[name.toLowerCase()] ?? null }, json: async () => response.body }
  })
  const deck = await api.createPresentation({ title: 'Restored R', theme: 'black',
    slides: [{ id: 'restore-slide', elements: [] }] })
  deckId = deck.id
  await api.saveSnapshot(deckId, 'Restore target')
  await api.updatePresentation(deckId, { title: 'Initial live' })
  requests.length = 0
})

afterEach(async () => {
  release.resolve()
  cleanup()
  await act(async () => {})
  vi.unstubAllGlobals()
  useUIStore.setState({ showHistoryModal: false })
})

async function restoreWithOutstandingSave(transport) {
  const mounted = render(<Harness />)
  await waitFor(() => expect(current.persistence.loading).toBe(false))
  act(() => current.setPresentation({ ...current.presentation, title: 'Outstanding A' }))
  if (transport === 'normal PUT') act(() => current.persistence.handleManualSave())
  else fireEvent(window, new Event('beforeunload'))
  await act(async () => held.promise)
  // A queued successor must not leak through the restore boundary either.
  act(() => current.setPresentation({ ...current.presentation, title: 'Queued B' }))
  act(() => useUIStore.getState().setShowHistoryModal(true))
  const history = await screen.findByRole('dialog', { name: 'Version History' })
  fireEvent.click(await within(history).findByRole('button', { name: 'Restore' }))
  const confirm = screen.getByRole('dialog', { name: 'Restore snapshot' })
  fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }))
  await act(async () => {})
  const restoredBeforeTransportSettled = requests.some(entry => /\/restore\//.test(entry.url))
  // Reproduce the observed durable overwrite only when restore was incorrectly dispatched early.
  if (restoredBeforeTransportSettled) await act(async () => expect(await restoreFinished.promise).toBe(200))
  await act(async () => {
    release.resolve()
    expect(await finished.promise).toBe(200)
  })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Version History' })).toBeNull())
  expect(screen.getByLabelText('Editor title').textContent).toBe('Restored R')
  expect(current.history.canUndo).toBe(false)
  expect(current.history.canRedo).toBe(false)
  expect(usePresentationStore.getState().saveConflict).toBeNull()
  expect(await readEditorDraft(deckId)).toBeNull()
  const persisted = await api.getPresentation(deckId)
  mounted.unmount()
  render(<Harness />)
  await waitFor(() => expect(current.persistence.loading).toBe(false))
  return { restoredBeforeTransportSettled, persisted, reloaded: current.presentation,
    saves: requests.filter(entry => entry.method === 'PUT') }
}

describe('Version history restore with outstanding real save transports', () => {
  it.each(['normal PUT', 'keepalive PUT'])('waits for %s completion before sending the restore request', async transport => {
    const result = await restoreWithOutstandingSave(transport)
    expect(result.restoredBeforeTransportSettled).toBe(false)
    expect(result.saves).toHaveLength(1)
    expect(Boolean(result.saves[0].keepalive)).toBe(transport === 'keepalive PUT')
  })

  it.each(['normal PUT', 'keepalive PUT'])('keeps restored data durable through delayed %s success and editor reload', async transport => {
    const result = await restoreWithOutstandingSave(transport)
    expect(result.persisted.title).toBe('Restored R')
    expect(result.reloaded.title).toBe('Restored R')
    expect(result.persisted.slides[0].id).toBe('restore-slide')
    expect(result.saves).toHaveLength(1)
  })
})
