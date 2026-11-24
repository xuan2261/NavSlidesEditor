import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEditorDraft, readEditorDraft, writeEditorDraft } from './editor-draft-store'
import { rebaseEditorSaveEntry } from '../hooks/editor-controller/editor-save-attempt'
import * as envelope from './editor-draft-semantic-envelope'

const localKey = 'navslides-editor-draft:presentation:transaction-deck'
const draft = (attemptId) => createEditorDraft({
  snapshot: { id: 'transaction-deck', title: `revision-${attemptId}` },
  attemptId,
  draftId: `session:${attemptId}`,
})

// Explicitly separate request success from commit (including abort-after-success).
function controlledDatabase() {
  const request = { result: 'transaction-deck' }
  const store = { put: vi.fn(() => request), get: vi.fn(() => request) }
  const transaction = { objectStore: () => store }
  const database = { transaction: vi.fn(() => transaction), close: vi.fn() }
  vi.stubGlobal('indexedDB', {
    open: () => {
      const openRequest = { result: database }
      queueMicrotask(() => openRequest.onsuccess())
      return openRequest
    },
  })
  return { request, store, transaction, database }
}

async function started(database) {
  await vi.waitFor(() => expect(database.transaction).toHaveBeenCalled())
}

function succeed(request) {
  request.onsuccess?.()
}

describe('editor draft transaction commit boundary', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('acknowledges an actual rebase locally without waiting for cleanup', async () => {
    const { request, transaction, database } = controlledDatabase()
    request.result = null
    const entry = draft(2)
    rebaseEditorSaveEntry(entry, 7, false)
    await expect(entry.draftWritePromise).resolves.toBe(true)
    await started(database)
    expect(envelope.draftMetadata(JSON.parse(localStorage.getItem(localKey))).snapshot.aggregateGeneration).toBe(7)
    expect(database.close).not.toHaveBeenCalled()
    succeed(request)
    transaction.oncomplete()
    await vi.waitFor(() => expect(database.close).toHaveBeenCalledOnce())
  })

  it.each([false, true])('acknowledges an actual IDB-only rebase only on commit (abort %s)', async (abort) => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied') })
    const { request, transaction, database, store } = controlledDatabase()
    request.result = null
    const entry = draft(2)
    const settled = vi.fn()
    rebaseEditorSaveEntry(entry, 7, false)
    const writing = entry.draftWritePromise.then(settled)
    await started(database)
    succeed(request)
    expect(store.put).toHaveBeenCalledWith(expect.objectContaining({
      record: expect.objectContaining({ snapshot: expect.objectContaining({ aggregateGeneration: 7 }) }),
    }))
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    if (abort) transaction.onabort()
    else transaction.oncomplete()
    await writing
    expect(settled).toHaveBeenCalledWith(!abort)
  })

  it('does not delay a committed IDB rebase acknowledgement for an optional checkpoint', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('denied') })
    vi.spyOn(envelope, 'checkpointNeeded').mockReturnValue(true)
    vi.spyOn(envelope, 'checkpointRecord').mockReturnValue({ key: 'optional-checkpoint' })
    const accepted = vi.spyOn(envelope, 'acceptCheckpoint').mockImplementation(() => {})
    const { request, transaction, database } = controlledDatabase()
    request.result = null
    const entry = draft(2)
    rebaseEditorSaveEntry(entry, 7, false)
    await started(database)
    succeed(request)
    transaction.oncomplete()
    await expect(entry.draftWritePromise).resolves.toBe(true)
    await vi.waitFor(() => expect(database.transaction).toHaveBeenCalledTimes(2))
    expect(accepted).not.toHaveBeenCalled()
    succeed(request)
    transaction.oncomplete()
    await vi.waitFor(() => expect(accepted).toHaveBeenCalledOnce())
  })

  it('skips duplicate checkpoint eligibility only for a compact head', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const compact = vi.spyOn(envelope, 'compactDraft').mockImplementation(captured => ({
      ...captured.record, semanticDraftVersion: 1, semanticBaseline: 'committed-base',
    }))
    const needed = vi.spyOn(envelope, 'checkpointNeeded').mockReturnValue(false)
    const { request, transaction, database } = controlledDatabase()
    request.result = null
    const entry = draft(2)
    rebaseEditorSaveEntry(entry, 7, false)
    await expect(entry.draftWritePromise).resolves.toBe(true)
    await started(database)
    succeed(request)
    transaction.oncomplete()
    // A full fallback drains the compact maintenance and must still check eligibility.
    compact.mockReturnValue(null)
    const full = writeEditorDraft(draft(3))
    await vi.waitFor(() => expect(database.transaction).toHaveBeenCalledTimes(2))
    expect(needed).not.toHaveBeenCalled()
    succeed(request)
    transaction.oncomplete()
    await full
    expect(needed).toHaveBeenCalledOnce()
  })

  it('keeps the synchronous local fallback before any async storage work', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const pending = draft(1)
    const writing = writeEditorDraft(pending)
    expect(envelope.draftMetadata(JSON.parse(localStorage.getItem(localKey)))).toEqual(pending)
    await expect(writing).resolves.toBe(true)
  })

  it('does not acknowledge a put or remove the older local copy until commit', async () => {
    const older = draft(1)
    localStorage.setItem(localKey, JSON.stringify(older))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const { request, transaction, database } = controlledDatabase()
    const settled = vi.fn()
    const writing = writeEditorDraft(draft(2), { acknowledgeLocalPublication: true }).then(settled)
    await started(database)

    succeed(request)
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    expect(database.close).not.toHaveBeenCalled()
    expect(envelope.draftMetadata(JSON.parse(localStorage.getItem(localKey)))).toEqual(older)

    transaction.oncomplete()
    await writing
    expect(settled).toHaveBeenCalledWith(true)
    expect(localStorage.getItem(localKey)).toBeNull()
    expect(database.close).toHaveBeenCalledOnce()
  })

  it.each(['abort', 'error', 'request-error'])('reports %s after put success without discarding fallback', async (event) => {
    const older = draft(1)
    localStorage.setItem(localKey, JSON.stringify(older))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const { request, transaction, database } = controlledDatabase()
    const writing = writeEditorDraft(draft(2), { acknowledgeLocalPublication: true })
    await started(database)
    succeed(request)
    if (event === 'request-error') request.onerror()
    else transaction[`on${event}`]()
    await expect(writing).resolves.toBe(false)
    expect(envelope.draftMetadata(JSON.parse(localStorage.getItem(localKey)))).toEqual(older)
    expect(database.close).toHaveBeenCalledOnce()
  })

  it('acknowledges recoverable local publication while cleanup is held, but keeps default writes queued', async () => {
    const { request, transaction, database } = controlledDatabase()
    request.result = null
    const pending = draft(2)
    const acknowledged = vi.fn()
    await writeEditorDraft(pending, { acknowledgeLocalPublication: true }).then(acknowledged)
    await started(database)
    expect(acknowledged).toHaveBeenCalledWith(true)
    expect(envelope.draftMetadata(JSON.parse(localStorage.getItem(localKey)))).toEqual(pending)
    expect(database.close).not.toHaveBeenCalled()

    const idb = indexedDB
    vi.stubGlobal('indexedDB', undefined)
    await expect(readEditorDraft(pending.id)).resolves.toEqual(pending)
    vi.stubGlobal('indexedDB', idb)
    const settled = vi.fn()
    const queued = writeEditorDraft(draft(3)).then(settled)
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    succeed(request)
    transaction.oncomplete()
    await vi.waitFor(() => expect(database.transaction).toHaveBeenCalledTimes(2))
    succeed(request)
    transaction.oncomplete()
    await queued
    expect(settled).toHaveBeenCalledWith(true)
  })

  it.each([false, true])('serializes independent writers under the IDB lock (newer first: %s)', async (newerFirst) => {
    // Separate module queues model tabs; only the database lock is shared.
    vi.resetModules()
    const writerA = await import('./editor-draft-store')
    vi.resetModules()
    const writerB = await import('./editor-draft-store')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
    let head
    const transactions = []
    const db = { close: vi.fn(), transaction: () => {
      const get = {}
      let pending
      const store = { get: vi.fn(() => get), put: vi.fn(record => {
        pending = structuredClone(record)
        return {}
      }) }
      const tx = { objectStore: () => store }
      transactions.push({ store, read: () => {
        get.result = structuredClone(head)
        get.onsuccess()
      }, commit: () => {
        if (pending) head = pending
        tx.oncomplete()
      } })
      return tx
    } }
    vi.stubGlobal('indexedDB', { open: () => {
      const req = { result: db }
      queueMicrotask(() => req.onsuccess())
      return req
    } })
    const older = { ...draft(1), updatedAt: '2026-01-01T00:00:00Z' }
    const newer = { ...draft(2), updatedAt: '2026-01-02T00:00:00Z' }
    const first = writerA.writeEditorDraft(newerFirst ? newer : older, { acknowledgeLocalPublication: true })
    const second = writerB.writeEditorDraft(newerFirst ? older : newer, { acknowledgeLocalPublication: true })
    await vi.waitFor(() => expect(transactions).toHaveLength(2))
    // A real IDB readwrite lock services the second get only after commit.
    transactions[0].read()
    transactions[0].commit()
    await expect(first).resolves.toBe(true)
    transactions[1].read()
    if (newerFirst) expect(transactions[1].store.put).not.toHaveBeenCalled()
    transactions[1].commit()
    await expect(second).resolves.toBe(!newerFirst)
    expect(envelope.draftMetadata(head)).toEqual(newer)
    expect(db.close).toHaveBeenCalledTimes(2)
  })

  it('does not overwrite a newer local head with a stale independent writer', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const newer = { ...draft(2), updatedAt: '2026-01-02T00:00:00Z' }
    const older = { ...draft(1), updatedAt: '2026-01-01T00:00:00Z' }
    await expect(writeEditorDraft(newer, { acknowledgeLocalPublication: true })).resolves.toBe(true)
    await expect(writeEditorDraft(older, { acknowledgeLocalPublication: true })).resolves.toBe(false)
    await expect(readEditorDraft(newer.id)).resolves.toEqual(newer)
  })

  it.each([false, true])('settles blocked recovery immediately with local fallback: %s', async (hasLocal) => {
    const pending = draft(2)
    if (hasLocal) localStorage.setItem(localKey, JSON.stringify(pending))
    const database = { close: vi.fn(), transaction: vi.fn(), createObjectStore: vi.fn() }
    const request = { result: database, transaction: { abort: vi.fn() } }
    vi.stubGlobal('indexedDB', { open: () => {
      queueMicrotask(() => request.onblocked())
      return request
    } })
    await expect(readEditorDraft('transaction-deck')).resolves.toEqual(hasLocal ? pending : null)
    // IDB open cannot be cancelled: clean up an eventual upgrade/success.
    request.onupgradeneeded()
    expect(request.transaction.abort).toHaveBeenCalledOnce()
    expect(database.createObjectStore).not.toHaveBeenCalled()
    request.onsuccess()
    expect(database.close).toHaveBeenCalledOnce()
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it('rejects blocked IDB-only durability without acknowledging or losing the fallback', async () => {
    const older = draft(1)
    localStorage.setItem(localKey, JSON.stringify(older))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
    vi.stubGlobal('indexedDB', { open: () => {
      const request = {}
      queueMicrotask(() => request.onblocked())
      return request
    } })
    await expect(writeEditorDraft(draft(2), { acknowledgeLocalPublication: true })).resolves.toBe(false)
    expect(envelope.draftMetadata(JSON.parse(localStorage.getItem(localKey)))).toEqual(older)
  })

  it('returns the read result only when its transaction completes', async () => {
    const { request, transaction, database } = controlledDatabase()
    request.result = draft(2)
    const settled = vi.fn()
    const reading = readEditorDraft('transaction-deck').then(settled)
    await started(database)
    succeed(request)
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    transaction.oncomplete()
    await reading
    expect(settled).toHaveBeenCalledWith(request.result)
  })

  it('does not return an aborted read result', async () => {
    const { request, transaction, database } = controlledDatabase()
    request.result = draft(2)
    const reading = readEditorDraft('transaction-deck')
    await started(database)
    succeed(request)
    transaction.onabort()
    await expect(reading).resolves.toBeNull()
  })
})
