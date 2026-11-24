// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pictureFixture } from './semantic-picture-fixture'
import NativePictureProperties from '../../client/src/components/properties/native-picture-properties'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'
import { api } from '../../client/src/utils/api'
const noop = () => {}
const receipt = { kind: 'uploaded-picture', presentationId: 'pictures', filename: 'replacement.png',
  sha256: 'b'.repeat(64), width: 2, height: 1 }
let uploadsDir
beforeEach(async () => { uploadsDir = await mkdtemp(join(tmpdir(), 'picture-replace-controller-')) })
afterEach(async () => { cleanup(); vi.restoreAllMocks(); await rm(uploadsDir, { recursive: true, force: true }) })
async function mount() {
  const { presentation: initial } = await pictureFixture({ uploadsDir })
  let current, history, setCurrent
  function Harness() {
    const [deck, setDeck] = useState(initial)
    const editingElementIdRef = useRef(null)
    const selectedElementIdsRef = useRef([deck.slides[0].elements[0].id])
    const controller = useEditorElementController({
      presentation: deck, setPresentation: setDeck, activeSlide: deck.slides[0],
      editingElementIdRef, setEditingElementId: noop, setSelectedElementIds: noop,
      mapActive: (previous, apply) => ({ ...previous, slides: previous.slides.map(apply) }),
    })
    const snapshots = useEditorHistoryController({
      presentation: deck, setPresentation: setDeck, setCurrentSlideIndex: noop,
      setVerticalEdit: noop, currentSlideIndexRef: useRef(0), verticalEditRef: useRef(null),
      selectedElementIdsRef, editingElementIdRef, setSelectedElementIds: noop,
      setEditingElementId: noop, resetContent: noop,
    })
    useLayoutEffect(() => {
      current = deck
      setCurrent = setDeck
      history = { ...snapshots, seed: () => { snapshots.seedHistory(deck); setDeck({ ...deck }) } }
    }, [deck, snapshots])
    return <NativePictureProperties element={deck.slides[0].elements[0]} document={deck.pptxSemantic}
      slideLocked={deck.slides[0].locked}
      onUpdate={(update) => controller.updateElement(deck.slides[0].elements[0].id, update)} />
  }
  const view = render(<MemoryRouter initialEntries={['/editor/pictures']}>
    <Routes><Route path="/editor/:id" element={<Harness />} /></Routes>
  </MemoryRouter>)
  act(() => history.seed())
  return { ...view, initial, current: () => current, history: () => history, set: (value) => setCurrent(value) }
}
function choose() {
  fireEvent.change(screen.getByLabelText('Replace picture file'), {
    target: { files: [new File(['image bytes'], 'new.png', { type: 'image/png' })] },
  })
}
describe('picture upload through actual editor and history controllers', () => {
  it('dispatches a scoped replacement and preserves source/crop through Undo, Redo, reset, and restore', async () => {
    const upload = vi.spyOn(api, 'uploadFile').mockResolvedValue({ pictureReplacement: receipt })
    const state = await mount()
    await act(async () => { choose() })
    expect(screen.queryByRole('status')).toBeNull()
    expect(upload).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({
      presentationId: 'pictures', purpose: 'picture-replacement', signal: expect.any(AbortSignal),
    }))
    expect(state.current().slides[0].elements[0].src).toBe('/uploads/replacement.png')
    expect(state.current().pptxSemantic.definitions).toEqual(state.initial.pptxSemantic.definitions)
    expect(state.current().slides[0].elements[1]).toEqual(state.initial.slides[0].elements[1])
    const changed = state.current()
    act(() => state.history().handleUndo())
    expect(state.current()).toEqual(state.initial)
    act(() => state.history().handleRedo())
    expect(state.current()).toEqual(changed)
    fireEvent.click(screen.getByRole('button', { name: 'Reset picture crop and alpha' }))
    expect(state.current().slides[0].elements[0].src).toBe('/uploads/replacement.png')
    fireEvent.click(screen.getByRole('button', { name: 'Restore source picture' }))
    expect(state.current()).toEqual(state.initial)
  })
  it.each(['locked', 'unmounted', 'changed-replacement', 'undo'])('ignores stale upload completion after %s', async (mode) => {
    let resolve
    const finished = new Promise((done) => { resolve = done })
    const upload = vi.spyOn(api, 'uploadFile').mockReturnValue(finished)
    const state = await mount()
    choose()
    expect(upload).toHaveBeenCalledOnce()
    if (mode === 'locked') act(() => state.set({ ...state.current(), slides: [{ ...state.current().slides[0], locked: true }] }))
    if (mode === 'unmounted') state.unmount()
    if (mode === 'changed-replacement') {
      const { default: operations } = await import('../../shared/src/pptx-projection-operation')
      const element = state.current().slides[0].elements[0]
      act(() => state.set(operations.applyPresentationProjectionOperation(state.current(), {
        type: 'picture.edit', instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
        command: { type: 'replace', replacement: { ...receipt, filename: 'newer.png' }, expectedReplacement: null },
      })))
    }
    if (mode === 'undo') {
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Picture crop left (%)' }), {
        target: { value: '0.75' },
      })
      act(() => state.history().handleUndo())
      expect(state.current()).toEqual(state.initial)
    }
    const before = state.current()
    await act(async () => { resolve({ pictureReplacement: receipt }); await finished })
    expect(state.current()).toEqual(before)
  })
  it('a second upload supersedes an earlier pending upload', async () => {
    let first, second
    const earlier = new Promise((resolve) => { first = resolve })
    const later = new Promise((resolve) => { second = resolve })
    vi.spyOn(api, 'uploadFile').mockReturnValueOnce(earlier).mockReturnValueOnce(later)
    const state = await mount()
    choose()
    choose()
    await act(async () => { second({ pictureReplacement: { ...receipt, filename: 'newer.png' } }); await later })
    const latest = state.current()
    expect(latest.slides[0].elements[0].src).toBe('/uploads/newer.png')
    await act(async () => { first({ pictureReplacement: receipt }); await earlier })
    expect(state.current()).toEqual(latest)
  })
})
