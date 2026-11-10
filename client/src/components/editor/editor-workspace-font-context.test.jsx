import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditorWorkspace from './editor-workspace'
import { PptxSourceFontProvider } from '../../contexts/pptx-source-font-context'
import { usePptxSourceFonts } from '../../hooks/use-pptx-source-fonts'
import { familyDocumentsFixture } from '../../../../tests/pptx-semantic/family-documents-fixture'

const load = vi.hoisted(() => vi.fn())
vi.mock('../../hooks/use-pptx-source-font-loader', () => ({ loadPptxSourceFontRuntime: load }))
vi.mock('./editor-navigator', () => ({ default: () => null }))
vi.mock('./editor-ribbon', () => ({ default: () => null }))
vi.mock('./editor-inspector', () => ({ default: () => <Probe label="inspector" /> }))
vi.mock('./editor-canvas-workspace', () => ({
  default: ({ c }) => (
    <PptxSourceFontProvider
      presentationId={c.presentation.id}
      pptxSemantic={c.presentation.pptxSemantic}
      fontRevision={c.fontRevision}
    >
      <Probe label="canvas" />
    </PptxSourceFontProvider>
  ),
}))
function Probe({ label }) {
  const { status, fontRuntime } = usePptxSourceFonts()
  return (
    <output data-testid={label}>
      {status}:{fontRuntime?.name ?? 'none'}
    </output>
  )
}
afterEach(() => {
  cleanup()
  load.mockReset()
})

describe('one source-font owner for canvas and inspector', () => {
  it('shares the workspace runtime with nested canvas scope and retains it on ACK', async () => {
    const runtime = { name: 'workspace', dispose: vi.fn() }
    load.mockResolvedValue({ fontRuntime: runtime, sourceIdentity: 'source' })
    const c = {
      presentation: { id: 'deck', pptxSemantic: (await familyDocumentsFixture()).table },
      fontRevision: new Date(0),
    }
    const view = render(<EditorWorkspace c={c} workspaceTier="wide" />)
    await act(async () => {})
    expect(screen.getByTestId('canvas').textContent).toBe('ready:workspace')
    expect(screen.getByTestId('inspector').textContent).toBe('ready:workspace')
    expect(load).toHaveBeenCalledOnce()
    view.rerender(<EditorWorkspace c={{ ...c, fontRevision: new Date(1) }} workspaceTier="wide" />)
    await act(async () => {})
    expect(load).toHaveBeenCalledOnce()
    expect(runtime.dispose).not.toHaveBeenCalled()
    view.unmount()
    expect(runtime.dispose).toHaveBeenCalledOnce()
  })
  it.each(['presentation', 'outputDocument'])(
    'does not inherit across a different %s boundary',
    async (boundary) => {
      let count = 0
      const runtimes = []
      load.mockImplementation(async () => {
        const runtime = { name: `scope-${++count}`, dispose: vi.fn() }
        runtimes.push(runtime)
        return { fontRuntime: runtime }
      })
      const semantic = (await familyDocumentsFixture()).table
      const child =
        boundary === 'presentation'
          ? { presentationId: 'other' }
          : { document: document.implementation.createHTMLDocument('output') }
      const view = render(
        <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic}>
          <Probe label="outer" />
          <PptxSourceFontProvider presentationId="deck" pptxSemantic={semantic} {...child}>
            <Probe label="inner" />
          </PptxSourceFontProvider>
        </PptxSourceFontProvider>
      )
      await act(async () => {})
      expect(load).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('outer').textContent).not.toBe(
        screen.getByTestId('inner').textContent
      )
      view.unmount()
      for (const runtime of runtimes) expect(runtime.dispose).toHaveBeenCalledOnce()
    }
  )
})
