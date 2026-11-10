// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PptxSourceFontProvider } from '../../client/src/contexts/pptx-source-font-context'
import { usePptxSourceFonts } from '../../client/src/hooks/use-pptx-source-fonts'

const hash = 'a'.repeat(64)
const semantic = { schemaVersion: 1, definitions: { d: { id: 'd', kind: 'text',
  source: { partUri: 'ppt/slides/slide1.xml', nativeId: '1', preconditionHash: hash },
  components: ['body', 'p', 'r'].map((id, i) => ({ id, kind: i === 2 ? 'run' : 'paragraph',
    locator: { path: [0, i], preconditionHash: hash } })),
  content: { textDocument: { schemaVersion: 1, componentId: 'body', body: {},
    paragraphs: [{ componentId: 'p', properties: {},
      defaultRunProperties: { fontLatin: { typeface: 'KaTeX_Main' } },
      runs: [{ componentId: 'r', kind: 'text', text: 'Source', properties: {} }] }] } },
} }, instances: { i: { id: 'i', slideId: 's', definitionId: 'd', parentInstanceId: null,
  localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } }, styles: {}, fonts: {} }
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
function Consumer() {
  const value = usePptxSourceFonts()
  return <output>{value.status}:{value.fontRuntime?.name ?? 'none'}</output>
}
const provider = (load, children = <Consumer />) =>
  <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic} loadRuntime={load}>
    {children}
  </PptxSourceFontProvider>
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('source font provider browser environment ownership', () => {
  it.each([
    ['devicePixelRatio', window, 3, 'resize'],
    ['language', navigator, 'vi-VN', 'languagechange'],
    ['userAgent', navigator, 'changed-browser', 'pageshow'],
    ['platform', navigator, 'changed-platform', 'focus'],
  ])('replaces owned runtime when %s changes', async (key, target, changed, event) => {
    let profile = target[key]
    vi.spyOn(target, key, 'get').mockImplementation(() => profile)
    const first = { name: 'first', dispose: vi.fn() }, next = { name: 'next', dispose: vi.fn() }
    const pending = deferred()
    const load = vi.fn().mockResolvedValueOnce({ fontRuntime: first })
      .mockImplementationOnce(() => pending.promise)
    const view = render(provider(load))
    await act(async () => {})
    act(() => { profile = changed; window.dispatchEvent(new Event(event)) })
    expect(screen.getByText('loading:none')).toBeTruthy()
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(load.mock.calls[0][0].signal.aborted).toBe(true)
    expect(load.mock.calls[1][0].requestIdentity).toBe(load.mock.calls[0][0].requestIdentity)
    await act(async () => { pending.resolve({ fontRuntime: next }) })
    expect(screen.getByText('ready:next')).toBeTruthy()
    view.unmount()
    expect(next.dispose).toHaveBeenCalledOnce()
  })

  it('cancels pending profiles, disposes late results, and never resurrects a prior profile', async () => {
    let dpr = 1
    vi.spyOn(window, 'devicePixelRatio', 'get').mockImplementation(() => dpr)
    const first = deferred(), second = deferred(), third = deferred()
    const stale = { name: 'stale', dispose: vi.fn() }, late = { name: 'late', dispose: vi.fn() }
    const current = { name: 'current', dispose: vi.fn() }
    const load = vi.fn().mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise).mockImplementationOnce(() => third.promise)
    render(provider(load))
    act(() => { dpr = 3; window.dispatchEvent(new Event('resize')) })
    act(() => { dpr = 1; window.dispatchEvent(new Event('resize')) })
    expect(load).toHaveBeenCalledTimes(3)
    expect(load.mock.calls.slice(0, 2).every(([options]) => options.signal.aborted)).toBe(true)
    await act(async () => {
      first.resolve({ fontRuntime: stale }); second.resolve({ fontRuntime: late })
    })
    expect(stale.dispose).toHaveBeenCalledOnce()
    expect(late.dispose).toHaveBeenCalledOnce()
    expect(screen.getByText('loading:none')).toBeTruthy()
    await act(async () => { third.resolve({ fontRuntime: current }) })
    expect(screen.getByText('ready:current')).toBeTruthy()
  })

  it('shares nested ownership and ignores ordinary resize with an identical environment', async () => {
    const runtime = { name: 'shared', dispose: vi.fn() }
    const load = vi.fn().mockResolvedValue({ fontRuntime: runtime })
    const view = render(provider(load, provider(load)))
    await act(async () => {})
    act(() => {
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('pageshow'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(load).toHaveBeenCalledOnce()
    expect(runtime.dispose).not.toHaveBeenCalled()
    view.unmount()
    expect(runtime.dispose).toHaveBeenCalledOnce()
    act(() => { window.dispatchEvent(new Event('languagechange')) })
    expect(load).toHaveBeenCalledOnce()
  })

  it('rearms resolution media changes without requiring a viewport resize and removes listeners', async () => {
    let dpr = 1
    vi.spyOn(window, 'devicePixelRatio', 'get').mockImplementation(() => dpr)
    const media = []
    const matchMedia = vi.fn(() => {
      const query = new EventTarget()
      vi.spyOn(query, 'removeEventListener')
      media.push(query)
      return query
    })
    vi.stubGlobal('matchMedia', matchMedia)
    const load = vi.fn().mockImplementation(async () => ({ fontRuntime: { dispose: vi.fn() } }))
    const view = render(provider(load))
    await act(async () => {})
    expect(matchMedia).toHaveBeenLastCalledWith('(resolution: 1dppx)')
    await act(async () => { dpr = 3; media[0].dispatchEvent(new Event('change')) })
    expect(load).toHaveBeenCalledTimes(2)
    expect(matchMedia).toHaveBeenLastCalledWith('(resolution: 3dppx)')
    expect(media[0].removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    view.unmount()
    expect(media.at(-1).removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
