// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PptxSourceFontProvider, PptxSourceFontContext } from './pptx-source-font-context'
import { normalizePptxSemanticDocument } from 'revealjs-shared/src/pptx-semantic-document.js'
import { collectSemanticFontRequests, readCachedSemanticFontRequests } from 'revealjs-shared/src/pptx-source-font-request.js'

function model(face = 'Original') {
  const hash = 'a'.repeat(64)
  return { schemaVersion: 1, definitions: { d: { id: 'd', kind: 'text',
    source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: hash },
    components: ['body', 'p', 'r'].map((id, i) => ({ id, kind: i === 2 ? 'run' : 'paragraph',
      locator: { path: [0, i], preconditionHash: hash } })),
    content: { textDocument: { schemaVersion: 1, componentId: 'body', body: {},
      paragraphs: [{ componentId: 'p', properties: {}, defaultRunProperties: {
        fontLatin: { typeface: face } }, runs: [
        { componentId: 'r', kind: 'text', text: 'Source', properties: {} },
      ] }] } },
  } }, instances: { i: { id: 'i', slideId: 's', definitionId: 'd', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } }, styles: {}, fonts: {} }
}
function Consumer() {
  const value = React.useContext(PptxSourceFontContext)
  return <output>{value.status}:{value.fontRuntime?.name ?? 'none'}</output>
}
const flush = () => act(async () => { await vi.runOnlyPendingTimersAsync() })
afterEach(() => { cleanup(); vi.useRealTimers() })
describe('deferred cold font collection', () => {
  it.each(['ready', 'unavailable'])('preserves workspace DOM and one mount from cold pending through loading to %s', async (status) => {
    vi.useFakeTimers()
    const semantic = normalizePptxSemanticDocument(model())
    const mounted = vi.fn(), unmounted = vi.fn()
    function Workspace() {
      React.useEffect(() => { mounted(); return unmounted }, [])
      return <section data-testid="workspace"><Consumer /></section>
    }
    let resolve, reject
    const load = vi.fn(() => new Promise((done, fail) => { resolve = done; reject = fail }))
    const view = render(<PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}
      loadRuntime={load}><Workspace /></PptxSourceFontProvider>)
    const node = screen.getByTestId('workspace')
    expect(screen.getByText('loading:none')).toBeTruthy()
    expect(load).not.toHaveBeenCalled()
    await flush()
    expect(load).toHaveBeenCalledOnce()
    expect(screen.getByTestId('workspace')).toBe(node)
    expect(screen.getByText('loading:none')).toBeTruthy()
    await act(async () => {
      if (status === 'ready') resolve({ fontRuntime: { name: 'fonts', dispose: vi.fn() } })
      else reject(new Error('unavailable'))
    })
    expect(screen.getByText(status === 'ready' ? 'ready:fonts' : 'unavailable:none')).toBeTruthy()
    expect(screen.getByTestId('workspace')).toBe(node)
    expect(mounted).toHaveBeenCalledOnce()
    expect(unmounted).not.toHaveBeenCalled()
    view.unmount()
    expect(unmounted).toHaveBeenCalledOnce()
  })
  it('invalidates disposed ready state across invalid admission and exact-identity repair without remounting', async () => {
    const semantic = normalizePptxSemanticDocument(model())
    collectSemanticFontRequests(semantic)
    const invalid = model()
    invalid.instances.i.definitionId = 'missing'
    const old = { name: 'old', dispose: vi.fn() }, fresh = { name: 'fresh', dispose: vi.fn() }
    let repair
    const load = vi.fn().mockResolvedValueOnce({ fontRuntime: old })
      .mockImplementationOnce(() => new Promise(done => { repair = done }))
    const mounted = vi.fn(), observed = []
    function Workspace() {
      const value = React.useContext(PptxSourceFontContext)
      observed.push(value)
      React.useEffect(() => { mounted() }, [])
      return <section data-testid="workspace"><Consumer /></section>
    }
    const provider = root => <PptxSourceFontProvider presentationId="deck" pptxSemantic={root}
      loadRuntime={load}><Workspace /></PptxSourceFontProvider>
    const view = render(provider(semantic))
    await act(async () => {})
    const node = screen.getByTestId('workspace')
    expect(screen.getByText('ready:old')).toBeTruthy()
    view.rerender(provider(invalid))
    expect(screen.getByText('unavailable:none')).toBeTruthy()
    expect(old.dispose).toHaveBeenCalledOnce()
    const sinceInvalid = observed.length
    view.rerender(provider(semantic))
    expect(screen.getByText('loading:none')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
    expect(load.mock.calls[1][0].requestIdentity).toBe(load.mock.calls[0][0].requestIdentity)
    await act(async () => { repair({ fontRuntime: fresh }) })
    expect(screen.getByText('ready:fresh')).toBeTruthy()
    expect(observed.slice(sinceInvalid).every(value => value.fontRuntime !== old)).toBe(true)
    expect(screen.getByTestId('workspace')).toBe(node)
    expect(mounted).toHaveBeenCalledOnce()
    expect(fresh.dispose).not.toHaveBeenCalled()
  })
  it('publishes loading before collection and waits for runtime readiness', async () => {
    vi.useFakeTimers()
    const semantic = normalizePptxSemanticDocument(model())
    let resolve
    const load = vi.fn(() => new Promise(done => { resolve = done }))
    render(<PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic} loadRuntime={load}><Consumer /></PptxSourceFontProvider>)
    expect(screen.getByText('loading:none')).toBeTruthy()
    expect(readCachedSemanticFontRequests(semantic)).toBeUndefined()
    expect(load).not.toHaveBeenCalled()
    await flush()
    expect(readCachedSemanticFontRequests(semantic)).toBeTruthy()
    expect(screen.getByText('loading:none')).toBeTruthy()
    await act(async () => { resolve({ fontRuntime: { name: 'fonts', dispose: vi.fn() } }) })
    expect(screen.getByText('ready:fonts')).toBeTruthy()
  })
  it('cancels a cold route and keeps subsequent declaration edits synchronous', async () => {
    vi.useFakeTimers()
    const old = normalizePptxSemanticDocument(model('Old'))
    const next = normalizePptxSemanticDocument(model('New'))
    const load = vi.fn().mockResolvedValue({ fontRuntime: { name: 'new', dispose: vi.fn() } })
    const provider = (semantic, id) => <PptxSourceFontProvider presentationId={id} pptxSemantic={semantic} loadRuntime={load}><Consumer /></PptxSourceFontProvider>
    const view = render(provider(old, 'old-route'))
    view.rerender(provider(next, 'new-route'))
    expect(load).toHaveBeenCalledOnce()
    expect(load.mock.calls[0][0].requestIdentity).toBe(collectSemanticFontRequests(next).identity)
    await flush()
    expect(readCachedSemanticFontRequests(old)).toBeUndefined()
    expect(screen.getByText('ready:new')).toBeTruthy()
  })
  it('cancels collection on unmount and does not trust mutable cache identities', async () => {
    vi.useFakeTimers()
    const semantic = normalizePptxSemanticDocument(model())
    const load = vi.fn()
    const view = render(<PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic} loadRuntime={load}><Consumer /></PptxSourceFontProvider>)
    view.unmount()
    await flush()
    expect(readCachedSemanticFontRequests(semantic)).toBeUndefined()
    expect(load).not.toHaveBeenCalled()
    const raw = model()
    collectSemanticFontRequests(raw)
    expect(readCachedSemanticFontRequests(raw)).toBeUndefined()
    raw.instances.i.definitionId = 'missing'
    expect(() => readCachedSemanticFontRequests(raw)).toThrow()
  })
  it('inherits only the exact validated normalized document, including while pending', async () => {
    vi.useFakeTimers()
    const semantic = normalizePptxSemanticDocument(model())
    const load = vi.fn().mockResolvedValue({ fontRuntime: { name: 'shared', dispose: vi.fn() } })
    const snapshots = {}, mounts = vi.fn()
    function Snapshot({ id }) {
      snapshots[id] = React.useContext(PptxSourceFontContext)
      React.useEffect(() => { mounts(id) }, [id])
      return id === 'child' ? <div data-testid="nested"><Consumer /></div> : null
    }
    const nested = <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic} loadRuntime={load}><Snapshot id="child" /></PptxSourceFontProvider>
    render(<PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic} loadRuntime={load}><Snapshot id="parent" />{nested}</PptxSourceFontProvider>)
    const node = screen.getByTestId('nested')
    expect(snapshots.child).toBe(snapshots.parent)
    expect(load).not.toHaveBeenCalled()
    await flush()
    expect(load).toHaveBeenCalledOnce()
    expect(screen.getByText('ready:shared')).toBeTruthy()
    expect(snapshots.child).toBe(snapshots.parent)
    expect(screen.getByTestId('nested')).toBe(node)
    expect(mounts).toHaveBeenCalledTimes(2)
  })
  it('keeps public subscribers stable across text edits and revision acknowledgements while updating exact ownership', async () => {
    const first = normalizePptxSemanticDocument(model())
    collectSemanticFontRequests(first)
    const edited = model()
    edited.definitions.d.content.textDocument.paragraphs[0].runs[0].text = 'Edited'
    const next = normalizePptxSemanticDocument(edited)
    expect(collectSemanticFontRequests(next).identity).toBe(collectSemanticFontRequests(first).identity)
    const load = vi.fn().mockResolvedValue({ fontRuntime: { name: 'shared', dispose: vi.fn() },
      sourceIdentity: 'source', provenance: ['source'] })
    const observed = vi.fn()
    const MemoConsumer = React.memo(function Snapshot() {
      const value = React.useContext(PptxSourceFontContext)
      observed(value)
      return <Consumer />
    })
    const provider = (semantic, revision, nested = false) => <PptxSourceFontProvider
      presentationId="deck" pptxSemantic={semantic} fontRevision={revision} loadRuntime={load}>
      <MemoConsumer />
      {nested && <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}
        fontRevision={revision} loadRuntime={load}><Consumer /></PptxSourceFontProvider>}
    </PptxSourceFontProvider>
    const view = render(provider(first, 1))
    await act(async () => {})
    const snapshot = observed.mock.lastCall[0]
    const renders = observed.mock.calls.length
    view.rerender(provider(next, 1))
    view.rerender(provider(next, 2))
    expect(observed).toHaveBeenCalledTimes(renders)
    expect(observed.mock.lastCall[0]).toBe(snapshot)
    // A newly mounted child must inherit the new exact root and revision,
    // despite the unchanged public snapshot.
    view.rerender(provider(next, 2, true))
    await act(async () => {})
    expect(load).toHaveBeenCalledOnce()
    expect(observed).toHaveBeenCalledTimes(renders)
  })
  it('publishes a new public snapshot for diagnostic-only request changes', async () => {
    const raw = model()
    raw.definitions.d.content.textDocument.paragraphs[0].defaultRunProperties = {}
    const first = normalizePptxSemanticDocument(raw)
    const initial = collectSemanticFontRequests(first)
    const edited = structuredClone(raw)
    const textDocument = structuredClone(edited.definitions.d.content.textDocument)
    textDocument.paragraphs[0].runs[0].componentId = 'replacement'
    edited.instances.i.overrides = { components: { body: { textDocument } } }
    const next = normalizePptxSemanticDocument(edited)
    const changed = collectSemanticFontRequests(next)
    const runtime = { name: 'shared', dispose: vi.fn() }
    const load = vi.fn(async ({ requestIdentity }) => ({ fontRuntime: runtime,
      issues: requestIdentity === initial.identity ? initial.issues : changed.issues }))
    const observed = vi.fn()
    const MemoConsumer = React.memo(function Snapshot() {
      observed(React.useContext(PptxSourceFontContext))
      return null
    })
    const provider = semantic => <PptxSourceFontProvider presentationId="deck"
      pptxSemantic={semantic} loadRuntime={load}><MemoConsumer /></PptxSourceFontProvider>
    const view = render(provider(first))
    await act(async () => {})
    const snapshot = observed.mock.lastCall[0]
    view.rerender(provider(next))
    await act(async () => {})
    expect(load).toHaveBeenCalledTimes(2)
    expect(observed.mock.lastCall[0]).not.toBe(snapshot)
    expect(observed.mock.lastCall[0].issues).toEqual(changed.issues)
    expect(observed.mock.lastCall[0].issues).not.toEqual(snapshot.issues)
  })
  it('keeps diagnostic bindings in identity and rejects invalid admission immediately', async () => {
    vi.useFakeTimers()
    const raw = model()
    raw.definitions.d.content.textDocument.paragraphs[0].defaultRunProperties = {}
    const semantic = normalizePptxSemanticDocument(raw)
    const initial = collectSemanticFontRequests(semantic)
    const changed = structuredClone(raw)
    const textDocument = structuredClone(changed.definitions.d.content.textDocument)
    textDocument.paragraphs[0].runs[0].componentId = 'replacement'
    changed.instances.i.overrides = { components: { body: { textDocument } } }
    const next = collectSemanticFontRequests(changed)
    expect(next.identity).not.toBe(initial.identity)
    expect(next.issues).not.toEqual(initial.issues)
    raw.instances.i.definitionId = 'missing'
    const load = vi.fn()
    render(<PptxSourceFontProvider presentationId="deck" pptxSemantic={raw} loadRuntime={load}><Consumer /></PptxSourceFontProvider>)
    expect(screen.getByText('unavailable:none')).toBeTruthy()
    expect(load).not.toHaveBeenCalled()
  })
})
