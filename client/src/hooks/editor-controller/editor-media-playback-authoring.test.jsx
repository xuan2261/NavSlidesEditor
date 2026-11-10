// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import MediaProperties from '../../components/properties/media-properties'
import { usePresentationState } from '../use-presentation-state'
import { useSlideOperations } from '../use-slide-operations'
import { useEditorElementController } from './use-editor-element-controller'
import { useEditorSelectionController } from './use-editor-selection-controller'
import { createSemanticMediaFixture } from '../../../../tests/pptx-semantic/semantic-media-fixture'
import { projectSemanticImport } from '../../../../server/services/pptx-import/semantic-projector'
import { canonicalEditableSnapshot } from '../../../../server/services/pptx-import/canonical-snapshot'
import { assertSemanticBaseline } from '../../../../server/services/pptx-import/semantic-baseline'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import { renderSlideElements } from 'revealjs-shared/src/element-renderers.js'
import { applySemanticGeometry } from '../../utils/pptx-semantic-geometry-bridge'
import { applyPresentationProjectionOperation } from 'revealjs-shared/src/pptx-projection-operation.js'
import { getProjectionCapabilities } from 'revealjs-shared/src/pptx-projection-capabilities.js'

const seeds = {}
let uploadsDir
beforeAll(async () => {
  uploadsDir = await mkdtemp(path.join(tmpdir(), 'media-property-boundary-'))
  for (const mediaType of ['audio', 'video']) {
    const zip = await createSemanticMediaFixture({ mediaType, trimEnd: '2500.25', durationSeconds: 4 })
    const { presentation } = await projectSemanticImport({ zip, uploadsDir,
      presentation: { id: `property-${mediaType}`, slides: [{ id: 'slide', elements: [] }] } })
    const seed = structuredClone(presentation)
    const source = seed.slides[0].elements[0]
    const instance = seed.pptxSemantic.instances[source.pptxInstanceId]
    for (const suffix of ['selected-copy', 'untouched']) {
      const id = `${instance.id}-${suffix}`
      seed.pptxSemantic.instances[id] = { ...structuredClone(instance), id, paintIndex: suffix === 'untouched' ? 2 : 1 }
      seed.slides[0].elements.push({ ...structuredClone(source), id, pptxInstanceId: id })
    }
    seeds[mediaType] = semantic.normalizeSemanticPresentation(seed)
  }
})
afterEach(cleanup)
afterAll(async () => { if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true }) })

function mount(seed, count = 1) {
  const live = {}
  function Inspector() {
    const [deck, setPresentation] = usePresentationState(seed)
    const slide = deck.slides[0]
    const ids = slide.elements.slice(0, count).map((element) => element.id)
    const mapActive = (previous, update) => ({ ...previous, slides: [update(previous.slides[0])] })
    const context = { presentation: deck, activeSlide: slide, activeSlideRef: { current: slide },
      selectedElementIdsRef: { current: ids }, editingElementIdRef: { current: null },
      currentSlideIndexRef: { current: 0 }, setPresentation, mapActive,
      setEditingElementId: vi.fn(), setSelectedElementIds: vi.fn(), notifyBlockedAction: vi.fn() }
    const element = useEditorElementController(context)
    const batch = useSlideOperations({ ...context, mapActiveSlide: mapActive })
    const selection = useEditorSelectionController({ ...context, ...element, ...batch })
    Object.assign(live, { deck, element, batch, selection })
    return <MediaProperties element={slide.elements[0]} elements={slide.elements}
      selectedElementIds={ids} onUpdate={selection.updateSelectedElements} />
  }
  render(<Inspector />)
  return live
}

const expected = { startTime: 1.25, endTime: 2, playbackRate: 1.5, loop: true }
describe('source-bound media property authoring', () => {
  it.each(['audio', 'video'].flatMap((type) => [1, 2].map((count) => [type, count])))(
    'persists %s trim and playback through real inspector and %s selected occurrences', (type, count) => {
      const seed = seeds[type]
      const before = structuredClone(seed)
      const canonicalBefore = semantic.normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(canonicalEditableSnapshot(seed))))
      const live = mount(seed, count)
      fireEvent.change(screen.getByLabelText(`${type === 'audio' ? 'Audio' : 'Video'} start time`), { target: { value: '1.25' } })
      fireEvent.change(screen.getByLabelText(`${type === 'audio' ? 'Audio' : 'Video'} end time`), { target: { value: '2' } })
      fireEvent.change(screen.getByLabelText(`${type === 'audio' ? 'Audio' : 'Video'} playback speed`), { target: { value: '1.5' } })
      fireEvent.click(screen.getByLabelText('Loop'))
      for (const target of live.deck.slides[0].elements.slice(0, count)) {
        expect(target).toMatchObject(expected)
        const instance = live.deck.pptxSemantic.instances[target.pptxInstanceId]
        const source = live.deck.pptxSemantic.definitions[instance.definitionId].content.mediaDocument
        expect(instance.overrides.components?.[source.embeddedComponentId]?.mediaPlayback).toMatchObject(expected)
      }
      expect(live.deck.slides[0].elements.slice(count)).toEqual(before.slides[0].elements.slice(count))
      const snapshot = JSON.parse(JSON.stringify(canonicalEditableSnapshot(live.deck)))
      // Element fields are only a compatibility cache, never playback authority.
      for (const target of snapshot.slides[0].elements.slice(0, count))
        Object.assign(target, { startTime: 99, endTime: 100, playbackRate: 4, loop: false })
      const reopened = semantic.normalizeSemanticPresentation(snapshot)
      for (const target of reopened.slides[0].elements.slice(0, count)) expect(target).toMatchObject(expected)
      expect(renderSlideElements(reopened.slides[0], { pptxSemantic: reopened.pptxSemantic })).toContain('&quot;startTime&quot;:1.25')
      expect(reopened.slides[0].elements.slice(count)).toEqual(canonicalBefore.slides[0].elements.slice(count))
      for (const untouched of before.slides[0].elements.slice(count)) {
        expect(live.deck.pptxSemantic.instances[untouched.pptxInstanceId])
          .toEqual(before.pptxSemantic.instances[untouched.pptxInstanceId])
        expect(reopened.pptxSemantic.instances[untouched.pptxInstanceId])
          .toEqual(canonicalBefore.pptxSemantic.instances[untouched.pptxInstanceId])
      }
      expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(() => assertSemanticBaseline(seed, reopened)).not.toThrow()
      expect(seed).toEqual(before)
    }
  )

  it('exposes a source-component projection operation and rejects foreign or invalid occurrence overrides', () => {
    const seed = seeds.audio
    const target = seed.slides[0].elements[0]
    const instance = seed.pptxSemantic.instances[target.pptxInstanceId]
    const source = seed.pptxSemantic.definitions[instance.definitionId].content.mediaDocument
    const operation = { type: 'media.edit', instanceId: instance.id, componentId: source.embeddedComponentId,
      command: { type: 'set-playback', playback: expected } }
    expect(getProjectionCapabilities(seed.pptxSemantic, instance.id).operations).toContain('media.edit')
    const edited = applyPresentationProjectionOperation(seed, operation)
    expect(edited.slides[0].elements[0]).toMatchObject(expected)
    expect(edited.pptxSemantic.definitions).toEqual(seed.pptxSemantic.definitions)
    expect(() => applyPresentationProjectionOperation(seed, { ...operation, componentId: source.legacyComponentId })).toThrow()
    for (const [componentId, playback] of [[source.legacyComponentId, { startTime: 1.25 }],
      [source.embeddedComponentId, { startTime: 3 }], [source.embeddedComponentId, { src: '/uploads/forged.wav' }]]) {
      const bad = structuredClone(seed)
      bad.pptxSemantic.instances[instance.id].overrides.components = { [componentId]: { mediaPlayback: playback } }
      expect(() => semantic.normalizeSemanticPresentation(bad)).toThrow(/media|playback|trim/i)
    }
  })

  it('rejects invalid effective intervals and nonnumeric playback without mutating canonical state', () => {
    const seed = seeds.audio
    const before = structuredClone(seed)
    const id = seed.slides[0].elements[0].id
    for (const patch of [{ startTime: 3 }, { endTime: 0.5 }, { playbackRate: 0 },
      { startTime: -1 }, { endTime: Infinity }, { playbackRate: '1.5' }, { loop: 1 }]) {
      expect(() => applySemanticGeometry(seed.pptxSemantic, seed.slides[0], [{ id, ...patch }])).toThrow(/media|playback|trim/i)
      expect(seed).toEqual(before)
    }
  })

  it('keeps a media batch atomic when its second effective interval is invalid or its owner is locked', () => {
    const seed = seeds.audio
    const [first, second] = seed.slides[0].elements
    const before = structuredClone(seed)
    expect(() => applySemanticGeometry(seed.pptxSemantic, seed.slides[0], [
      { id: first.id, startTime: 1.25 }, { id: second.id, endTime: 0.5 },
    ])).toThrow(/media|playback|trim/i)
    expect(seed).toEqual(before)
    const locked = structuredClone(seed)
    locked.pptxSemantic.instances[second.pptxInstanceId].overrides.locked = true
    const lockedBefore = structuredClone(locked)
    const live = mount(locked, 2)
    act(() => live.selection.updateSelectedElements({ startTime: 1.25 }))
    expect(live.deck).toEqual(lockedBefore)
  })

  it.each(['slide', 'element', 'semantic'])('rejects %s locks at the actual property command boundary', (lock) => {
    const seed = structuredClone(seeds.audio)
    const target = seed.slides[0].elements[0]
    if (lock === 'slide') seed.slides[0].locked = true
    else if (lock === 'element') target.locked = true
    else seed.pptxSemantic.instances[target.pptxInstanceId].overrides.locked = true
    const before = structuredClone(seed)
    const live = mount(seed)
    act(() => live.selection.updateSelectedElements({ startTime: 1.25 }))
    expect(live.deck).toEqual(before)
  })
})
