// @vitest-environment jsdom
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PptxSourceFontProvider } from '../../client/src/contexts/pptx-source-font-context'
import { usePptxSourceFonts } from '../../client/src/hooks/use-pptx-source-fonts'
import SlideCanvas from '../../client/src/components/SlideCanvas'

const canvasLoad = vi.hoisted(() => vi.fn())
vi.mock('../../client/src/hooks/use-pptx-source-font-loader', () => ({
  loadPptxSourceFontRuntime: canvasLoad,
}))
vi.mock('../../client/src/components/canvas/canvas-semantic-instance-tree', () => ({
  default: () => <Consumer />,
}))

function Consumer() {
  const value = usePptxSourceFonts()
  return <output>{value.status}:{value.fontRuntime?.name ?? 'none'}</output>
}
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
function model(typeface = 'KaTeX_Main', bold = false) {
  const hash = 'a'.repeat(64)
  return { schemaVersion: 1, definitions: { d: { id: 'd', kind: 'text',
    source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: hash },
    components: ['body', 'p', 'r'].map((id, i) => ({ id, kind: i === 2 ? 'run' : 'paragraph',
      locator: { path: [0, i], preconditionHash: hash } })),
    content: { textDocument: { schemaVersion: 1, componentId: 'body', body: {},
      paragraphs: [{ componentId: 'p', properties: {}, defaultRunProperties: {
        fontLatin: { typeface }, bold }, runs: [
        { componentId: 'r', kind: 'text', text: 'Source', properties: {} },
      ] }] } },
  } }, instances: { i: { id: 'i', slideId: 's', definitionId: 'd', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } }, styles: {}, fonts: {} }
}
describe('actual source font provider lifecycle', () => {
  it('mounts the provider around actual SlideCanvas descendants with presentation identity', async () => {
    const runtime = { name: 'canvas', dispose: vi.fn() }
    canvasLoad.mockResolvedValue({ fontRuntime: runtime, sourceIdentity: 'canvas' })
    const view = render(<SlideCanvas editor={null} presentationId="deck" fontRevision={1}
      pptxSemantic={model()} slide={{ id: 's', elements: [] }} selectedElementIds={[]}
      editingElementId={null} showGrid={false} resolution={{ width: 960, height: 540 }} />)
    await act(async () => {})
    expect(screen.getByText('ready:canvas')).toBeTruthy()
    expect(canvasLoad).toHaveBeenCalledWith(expect.objectContaining({ presentationId: 'deck' }))
    view.unmount()
    expect(runtime.dispose).toHaveBeenCalledOnce()
  })
  it('hides stale runtimes synchronously and disposes late cancelled registration only', async () => {
    const first = deferred(), second = deferred(), calls = []
    const load = vi.fn((options) => {
      calls.push(options)
      return calls.length === 1 ? first.promise : second.promise
    })
    const a = { name: 'a', dispose: vi.fn() }, b = { name: 'b', dispose: vi.fn() }
    const renderProvider = (semantic, revision = 1) =>
      <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}
        fontRevision={revision} loadRuntime={load}><Consumer /></PptxSourceFontProvider>
    const view = render(renderProvider(model()))
    expect(screen.getByText('loading:none')).toBeTruthy()
    view.rerender(renderProvider(model('Different Source')))
    expect(calls[0].signal.aborted).toBe(true)
    await act(async () => { first.resolve({ fontRuntime: a, sourceIdentity: 'a' }) })
    expect(a.dispose).toHaveBeenCalledOnce()
    expect(screen.getByText('loading:none')).toBeTruthy()
    await act(async () => { second.resolve({ fontRuntime: b, sourceIdentity: 'b' }) })
    expect(screen.getByText('ready:b')).toBeTruthy()
    expect(b.dispose).not.toHaveBeenCalled()
    view.unmount()
    expect(b.dispose).toHaveBeenCalledOnce()
  })

  it('retries the same semantic snapshot after acknowledged save, with no fallback', async () => {
    const load = vi.fn().mockRejectedValueOnce(Object.assign(new Error('stale'), {
      code: 'source-font-source-stale',
    })).mockResolvedValueOnce({ fontRuntime: { name: 'saved', dispose: vi.fn() }, sourceIdentity: 'saved' })
    const semantic = model()
    const props = { presentationId: 'deck', pptxSemantic: semantic, loadRuntime: load }
    const view = render(<PptxSourceFontProvider {...props} fontRevision={1}><Consumer /></PptxSourceFontProvider>)
    await act(async () => {})
    expect(screen.getByText('unavailable:none')).toBeTruthy()
    view.rerender(<PptxSourceFontProvider {...props} fontRevision={2}><Consumer /></PptxSourceFontProvider>)
    await act(async () => {})
    expect(load).toHaveBeenCalledTimes(2)
    expect(screen.getByText('ready:saved')).toBeTruthy()
    view.unmount()
  })

  it('retains one physical runtime across geometry, text color, size and save revision changes', async () => {
    const runtime = { name: 'physical', dispose: vi.fn() }
    const load = vi.fn().mockResolvedValue({ fontRuntime: runtime, sourceIdentity: 'physical' })
    const renderProvider = (semantic, revision) =>
      <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}
        fontRevision={revision} loadRuntime={load}><Consumer /></PptxSourceFontProvider>
    const view = render(renderProvider(model(), 1))
    await act(async () => {})
    const changed = model()
    changed.instances.i.localTransform[4] = 998
    Object.assign(changed.definitions.d.content.textDocument.paragraphs[0].runs[0].properties,
      { fontSizePt: 30, color: { kind: 'srgb', value: 'FF0000' } })
    view.rerender(renderProvider(changed, 2))
    expect(screen.getByText('ready:physical')).toBeTruthy()
    await act(async () => {})
    expect(load).toHaveBeenCalledOnce()
    expect(runtime.dispose).not.toHaveBeenCalled()
    view.rerender(renderProvider(model('KaTeX_Main', true), 2))
    expect(screen.getByText('loading:none')).toBeTruthy()
    expect(runtime.dispose).toHaveBeenCalledOnce()
    await act(async () => {})
    expect(load).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('retries a stale response when acknowledgement arrived during that request', async () => {
    const pending = deferred(), runtime = { name: 'saved', dispose: vi.fn() }
    const load = vi.fn().mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce({ fontRuntime: runtime, sourceIdentity: 'saved' })
    const props = { presentationId: 'deck', pptxSemantic: model(), loadRuntime: load }
    const view = render(<PptxSourceFontProvider {...props} fontRevision={1}><Consumer /></PptxSourceFontProvider>)
    view.rerender(<PptxSourceFontProvider {...props} fontRevision={2}><Consumer /></PptxSourceFontProvider>)
    await act(async () => { pending.resolve(Promise.reject(new Error('stale'))) })
    expect(load).toHaveBeenCalledTimes(2)
    expect(screen.getByText('ready:saved')).toBeTruthy()
    view.unmount()
  })

  it('never resurrects disposed faces when navigating back during a pending load', async () => {
    const second = deferred(), third = deferred()
    const firstRuntime = { name: 'first', dispose: vi.fn() }
    const lateRuntime = { name: 'late', dispose: vi.fn() }
    const returnedRuntime = { name: 'returned', dispose: vi.fn() }
    const load = vi.fn().mockResolvedValueOnce({ fontRuntime: firstRuntime })
      .mockImplementationOnce(() => second.promise).mockImplementationOnce(() => third.promise)
    const provider = (face) => <PptxSourceFontProvider presentationId="deck"
      pptxSemantic={model(face)} loadRuntime={load}><Consumer /></PptxSourceFontProvider>
    const view = render(provider('First'))
    await act(async () => {})
    expect(screen.getByText('ready:first')).toBeTruthy()
    view.rerender(provider('Second'))
    expect(firstRuntime.dispose).toHaveBeenCalledOnce()
    view.rerender(provider('First'))
    expect(screen.getByText('loading:none')).toBeTruthy()
    await act(async () => { second.resolve({ fontRuntime: lateRuntime }) })
    expect(lateRuntime.dispose).toHaveBeenCalledOnce()
    expect(screen.getByText('loading:none')).toBeTruthy()
    await act(async () => { third.resolve({ fontRuntime: returnedRuntime }) })
    expect(screen.getByText('ready:returned')).toBeTruthy()
    view.unmount()
    expect(returnedRuntime.dispose).toHaveBeenCalledOnce()
  })

  it('recomputes face identity for edits within a mutable semantic snapshot', async () => {
    const first = { name: 'first', dispose: vi.fn() }, pending = deferred()
    const load = vi.fn().mockResolvedValueOnce({ fontRuntime: first })
      .mockImplementationOnce(() => pending.promise)
    const semantic = model()
    const provider = () => <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}
      loadRuntime={load}><Consumer /></PptxSourceFontProvider>
    const view = render(provider())
    await act(async () => {})
    semantic.definitions.d.content.textDocument.paragraphs[0].defaultRunProperties.italic = true
    view.rerender(provider())
    expect(screen.getByText('loading:none')).toBeTruthy()
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledTimes(2)
    view.unmount()
  })

  it('inherits only matching face identities as nested scopes diverge and rejoin', async () => {
    const shared = { name: 'shared', dispose: vi.fn() }, own = { name: 'own', dispose: vi.fn() }
    const load = vi.fn().mockResolvedValueOnce({ fontRuntime: shared })
      .mockResolvedValueOnce({ fontRuntime: own })
    const semantic = model()
    const provider = (nested) => <PptxSourceFontProvider presentationId="deck"
      pptxSemantic={semantic} loadRuntime={load}>
      <PptxSourceFontProvider presentationId="deck" pptxSemantic={nested} loadRuntime={load}>
        <Consumer />
      </PptxSourceFontProvider>
    </PptxSourceFontProvider>
    const view = render(provider(semantic))
    await act(async () => {})
    view.rerender(provider(model('Different Source')))
    expect(screen.getByText('loading:none')).toBeTruthy()
    await act(async () => {})
    expect(screen.getByText('ready:own')).toBeTruthy()
    view.rerender(provider(semantic))
    expect(screen.getByText('ready:shared')).toBeTruthy()
    expect(own.dispose).toHaveBeenCalledOnce()
    expect(shared.dispose).not.toHaveBeenCalled()
    view.unmount()
    expect(shared.dispose).toHaveBeenCalledOnce()
  })
})
