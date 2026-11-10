// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { duplicateSlidesAtIndices } from '../../client/src/hooks/slide-operation-helpers.js'
import { prepareSemanticCut } from '../../client/src/utils/pptx-semantic-cut.js'
import { mapActiveSlide } from '../../client/src/utils/active-slide-mapper.js'
import { createSemanticMediaTimingFixture } from './semantic-media-timing-fixture.js'

const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { resolveSlideTiming } = require('../../shared/src/pptx-timing-document')
const { normalizeElementAction, serializeElementAction } = require('../../shared/src/element-actions')
const { renderSlideElements } = require('../../shared/src/element-renderers')

const CAPTIONS = [{
  src: 'data:text/vtt;base64,V0VCVlRUCg==',
  srcLang: 'en', label: 'English captions', kind: 'captions', default: true,
}]
const PLAYBACK = {
  startTime: 1.25, endTime: 3, playbackRate: 1.5,
  controls: false, autoplay: false, loop: true, muted: true,
  poster: '/uploads/authored-poster.png', volume: 0.35,
  tracks: CAPTIONS, transcript: 'Authored transcript <not HTML>.',
  audioDescription: 'A speaker describes the source diagram.',
}

async function withImportedFixture(run) {
  const uploadsDir = await mkdtemp(path.join(tmpdir(), 'navslides-media-timing-'))
  try {
    const zip = await createSemanticMediaTimingFixture()
    const sourceBytes = await zip.generateAsync({ type: 'nodebuffer' })
    const input = { id: 'media-timing-deck', title: 'Media and source timing', slides: [{ id: 'source-slide', elements: [] }] }
    const before = JSON.stringify(input)
    const { presentation: imported } = await projectSemanticImport({ zip, presentation: input, uploadsDir })
    expect(JSON.stringify(input)).toBe(before)
    // Import-only compatibility caches are deliberately absent from saved decks.
    // Compare unchanged siblings at that same persisted boundary, not raw import.
    const presentation = reopen(imported)
    expect(presentation.pptxSemantic.definitions).toEqual(imported.pptxSemantic.definitions)
    await run({ presentation, zip, sourceBytes })
    expect(await zip.generateAsync({ type: 'nodebuffer' })).toEqual(sourceBytes)
  } finally {
    await rm(uploadsDir, { recursive: true, force: true })
  }
}

function media(presentation, nativeId, slide = presentation.slides[0]) {
  const element = slide.elements.find((candidate) => {
    const instance = presentation.pptxSemantic.instances[candidate.pptxInstanceId]
    return presentation.pptxSemantic.definitions[instance?.definitionId]?.source.nativeId === nativeId
  })
  expect(element, `media source ${nativeId} on ${slide.id}`).toBeDefined()
  return element
}

function timing(presentation, slide = presentation.slides[0]) {
  return resolveSlideTiming(presentation.pptxSemantic, slide)
}

function node(presentation, nativeTimeId, slide = presentation.slides[0]) {
  const result = timing(presentation, slide).nodes.find((candidate) => candidate.nativeTimeId === nativeTimeId)
  expect(result, `source timing node ${nativeTimeId} on ${slide.id}`).toBeDefined()
  return result
}

function editTiming(presentation, sourceNode, command, slide = presentation.slides[0]) {
  return applyPresentationProjectionOperation(presentation, {
    type: 'timing.edit', slideId: slide.id,
    definitionId: sourceNode.definitionId, nodeLocator: sourceNode.nodeLocator, command,
  })
}

function editMedia(presentation, element, playback) {
  const instance = presentation.pptxSemantic.instances[element.pptxInstanceId]
  const source = presentation.pptxSemantic.definitions[instance.definitionId].content.mediaDocument
  return applyPresentationProjectionOperation(presentation, {
    type: 'media.edit', instanceId: instance.id, componentId: source.embeddedComponentId,
    command: { type: 'set-playback', playback },
  })
}

function reopen(snapshot) {
  return normalizeSemanticPresentation(JSON.parse(JSON.stringify(canonicalEditableSnapshot(snapshot))))
}

function immutableSnapshot(presentation) {
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child)
      Object.freeze(value)
    }
    return value
  }
  return freeze(canonicalEditableSnapshot(presentation))
}

function duplicate(presentation) {
  let serial = 0
  const result = duplicateSlidesAtIndices(
    presentation.slides, [0], () => `duplicate-${++serial}`, 0, [], presentation.pptxSemantic,
  )
  return reopen({ ...presentation, slides: result.slides, pptxSemantic: result.pptxSemantic })
}

function rendered(presentation, slide = presentation.slides[0]) {
  const container = document.createElement('div')
  container.innerHTML = renderSlideElements(slide, { pptxSemantic: presentation.pptxSemantic })
  return container
}

describe('Task20 media and source timing semantic-save acceptance', () => {
  it('imports the authored timing tree, resolves real source targets, and discloses excluded commands without executing them', async () => {
    await withImportedFixture(async ({ presentation, zip }) => {
      const first = media(presentation, '2')
      const sibling = media(presentation, '3')
      expect(first).toMatchObject({ type: 'audio', startTime: 1.0005, endTime: 3.5, volume: 1, tracks: [] })
      expect(sibling.src).toBe(first.src)
      const resolved = timing(presentation)
      expect(resolved.nodes).toHaveLength(2)
      expect(resolved.nodes).toMatchObject([
        { nativeTimeId: '11', effect: 'fade-in', trigger: 'onClick', order: 1, durationMs: 400,
          status: 'ready', targetInstanceId: first.pptxInstanceId, sourceTarget: { spid: '2' } },
        { nativeTimeId: '21', effect: 'fade-out', trigger: 'afterPrevious', order: 2, durationMs: 400,
          status: 'ready', targetInstanceId: sibling.pptxInstanceId, sourceTarget: { spid: '3' } },
      ])
      expect(resolved.unsupported).toEqual(expect.arrayContaining([
        expect.objectContaining({ tag: 'cmd', reason: 'unsupported-effect' }),
      ]))
      const definition = presentation.pptxSemantic.definitions[resolved.nodes[0].definitionId]
      const source = definition.content.timingDocument
      expect(definition.kind).toBe('opaque')
      expect(source).toMatchObject({ schemaVersion: 1 })
      expect(source.xml).toContain('cmd="javascript:alert(1)"')
      expect(source.xml).toContain('nodeType="afterEffect"')
      expect(source.targetReferences.map((reference) => reference.spid)).toEqual(['2', '3', '2'])
      expect(await zip.file('ppt/slides/slide1.xml').async('string')).toContain(source.xml)
      for (const row of resolved.nodes) {
        expect(row.nodeLocator).toMatchObject({ path: expect.any(Array), preconditionHash: expect.stringMatching(/^[a-f0-9]{64}$/) })
        expect(row.sourceTarget.locator).toMatchObject({ path: expect.any(Array), preconditionHash: expect.any(String) })
      }
      const output = rendered(presentation)
      expect(output.querySelectorAll('audio')).toHaveLength(2)
      expect(output.querySelector('[data-ns-action]')).toBeNull()
      expect(output.innerHTML).not.toContain('javascript:alert(1)')
    })
  })

  it('retains trim, metadata and timing target/order/trigger through actual duplication, immutable undo-like snapshots and canonical save/reopen', async () => {
    await withImportedFixture(async ({ presentation: imported }) => {
      const baseline = immutableSnapshot(imported)
      const baselineBytes = JSON.stringify(baseline)
      const sibling = media(imported, '3')
      const siblingInstance = structuredClone(imported.pptxSemantic.instances[sibling.pptxInstanceId])
      let edited = editMedia(imported, media(imported, '2'), PLAYBACK)
      edited = editTiming(edited, node(edited, '11'), { type: 'set-target', targetInstanceId: sibling.pptxInstanceId })
      edited = editTiming(edited, node(edited, '11'), { type: 'set-order', order: 2 })
      edited = editTiming(edited, node(edited, '11'), { type: 'set-trigger', trigger: 'withPrevious' })
      edited = editTiming(edited, node(edited, '11'), { type: 'set-duration', durationMs: 750 })
      edited = editTiming(edited, node(edited, '11'), { type: 'set-delay', delayMs: 250 })
      edited = reopen(edited)
      const editedSnapshot = immutableSnapshot(edited)
      const editedBytes = JSON.stringify(editedSnapshot)
      expect(media(edited, '2')).toMatchObject(PLAYBACK)
      expect(media(edited, '3')).toEqual(sibling)
      expect(edited.pptxSemantic.instances[sibling.pptxInstanceId]).toEqual(siblingInstance)
      expect(node(edited, '11')).toMatchObject({ order: 2, trigger: 'withPrevious', targetInstanceId: sibling.pptxInstanceId, durationMs: 750, delayMs: 250 })
      expect(timing(edited).nodes.map((row) => row.nativeTimeId)).toEqual(['21', '11'])

      const duplicated = duplicate(edited)
      expect(duplicated.slides).toHaveLength(2)
      const copy = duplicated.slides[1]
      const copyMedia = media(duplicated, '2', copy)
      const copySibling = media(duplicated, '3', copy)
      expect(copyMedia.pptxInstanceId).not.toBe(media(edited, '2').pptxInstanceId)
      expect(copySibling.pptxInstanceId).not.toBe(sibling.pptxInstanceId)
      expect(copyMedia).toMatchObject(PLAYBACK)
      expect(copySibling).toMatchObject({ startTime: 1.0005, endTime: 3.5, volume: 1, tracks: [] })
      expect(node(duplicated, '11', copy)).toMatchObject({
        order: 2, trigger: 'withPrevious', targetInstanceId: copySibling.pptxInstanceId,
        durationMs: 750, delayMs: 250,
        sourceTarget: { spid: '2' }, nodeLocator: node(edited, '11').nodeLocator,
      })
      expect(node(duplicated, '11')).toMatchObject({ targetInstanceId: sibling.pptxInstanceId })
      expect(duplicated.slides[0]).toEqual(edited.slides[0])
      const duplicateSnapshot = immutableSnapshot(duplicated)
      const duplicateBytes = JSON.stringify(duplicateSnapshot)

      let changedCopy = editMedia(duplicated, copyMedia, { startTime: 0.5, endTime: 2.75, volume: 0.2, poster: '' })
      changedCopy = editTiming(changedCopy, node(changedCopy, '11', copy),
        { type: 'set-target', targetInstanceId: copyMedia.pptxInstanceId }, copy)
      changedCopy = editTiming(changedCopy, node(changedCopy, '11', copy), { type: 'set-order', order: 1 }, copy)
      changedCopy = editTiming(changedCopy, node(changedCopy, '11', copy), { type: 'set-trigger', trigger: 'onClick' }, copy)
      const finalSnapshot = immutableSnapshot(changedCopy)
      const saved = reopen(finalSnapshot)
      const savedCopy = saved.slides[1]
      expect(media(saved, '2', savedCopy)).toMatchObject({ ...PLAYBACK, startTime: 0.5, endTime: 2.75, volume: 0.2, poster: '' })
      expect(node(saved, '11', savedCopy)).toMatchObject({ order: 1, trigger: 'onClick', targetInstanceId: copyMedia.pptxInstanceId })
      expect(saved.slides[0]).toEqual(edited.slides[0])
      expect(media(saved, '3', savedCopy)).toEqual(copySibling)
      for (const [id, instance] of Object.entries(edited.pptxSemantic.instances)) {
        expect(saved.pptxSemantic.instances[id]).toEqual(instance)
      }

      // These are real canonical history payloads, not a mock undo reducer.
      // Restoring one must not retain aliases into a later edited occurrence.
      const undo = reopen(duplicateSnapshot)
      expect(media(undo, '2', undo.slides[1])).toMatchObject(PLAYBACK)
      expect(node(undo, '11', undo.slides[1])).toMatchObject({ order: 2, trigger: 'withPrevious', targetInstanceId: copySibling.pptxInstanceId })
      expect(canonicalEditableSnapshot(reopen(finalSnapshot))).toEqual(finalSnapshot)
      expect(canonicalEditableSnapshot(reopen(editedSnapshot))).toEqual(editedSnapshot)
      expect(canonicalEditableSnapshot(reopen(baseline))).toEqual(baseline)
      expect(JSON.stringify(baseline)).toBe(baselineBytes)
      expect(JSON.stringify(editedSnapshot)).toBe(editedBytes)
      expect(JSON.stringify(duplicateSnapshot)).toBe(duplicateBytes)
      expect(saved.pptxSemantic.definitions).toEqual(imported.pptxSemantic.definitions)
      expect(saved.pptxSemantic.sourceSlides).toEqual(imported.pptxSemantic.sourceSlides)
      expect(() => assertSemanticBaseline(imported, saved)).not.toThrow()

      const output = rendered(undo, undo.slides[1])
      const audio = output.querySelector('audio')
      expect(audio).not.toBeNull()
      expect(audio.hasAttribute('controls')).toBe(false)
      expect(audio.hasAttribute('muted')).toBe(true)
      const track = audio.querySelector('track')
      expect(track.getAttribute('src')).toBe(CAPTIONS[0].src)
      expect(track.getAttribute('kind')).toBe('captions')
      expect(track.getAttribute('srclang')).toBe('en')
      expect(track.getAttribute('label')).toBe('English captions')
      expect(track.hasAttribute('default')).toBe(true)
      expect(output.querySelector('.ns-media-transcript').textContent).toContain(PLAYBACK.transcript)
      expect(output.querySelector('.ns-media-transcript').querySelector('not')).toBeNull()
      expect(output.querySelector('.ns-media-audio-description').textContent).toBe(PLAYBACK.audioDescription)
    })
  })

  it('discloses a removed authored timing target after production cut and reopen, supports repair, and restores the intact snapshot', async () => {
    await withImportedFixture(async ({ presentation }) => {
      const target = media(presentation, '3')
      const original = editTiming(presentation, node(presentation, '11'), { type: 'set-target', targetInstanceId: target.pptxInstanceId })
      const history = immutableSnapshot(original)
      const before = JSON.stringify(original)
      const cut = prepareSemanticCut(original, original.slides[0].id, [target.id],
        (value, writer) => mapActiveSlide(value, 0, null, writer))
      expect(cut).not.toBeNull()
      const removed = reopen(cut.presentation)
      expect(removed.slides[0].elements.some((element) => element.id === target.id)).toBe(false)
      expect(removed.pptxSemantic.instances[target.pptxInstanceId].lineage).toMatchObject({ tombstone: true })
      expect(node(removed, '11')).toMatchObject({ status: 'unresolved', reason: 'missing-target', targetInstanceId: target.pptxInstanceId })
      expect(removed.slides[0].sourceTiming.overrides).toEqual(expect.arrayContaining([
        expect.objectContaining({ targetInstanceId: target.pptxInstanceId }),
      ]))
      const removedBytes = JSON.stringify(removed)
      expect(() => editTiming(removed, node(removed, '11'), { type: 'set-target', targetInstanceId: target.pptxInstanceId })).toThrow(TypeError)
      expect(JSON.stringify(removed)).toBe(removedBytes)
      const repaired = reopen(editTiming(removed, node(removed, '11'), {
        type: 'set-target', targetInstanceId: media(removed, '2').pptxInstanceId,
      }))
      expect(node(repaired, '11')).toMatchObject({ status: 'ready', targetInstanceId: media(removed, '2').pptxInstanceId })
      expect(node(repaired, '21')).toMatchObject({ status: 'unresolved', reason: 'missing-target' })
      expect(repaired.pptxSemantic.definitions).toEqual(original.pptxSemantic.definitions)
      expect(() => assertSemanticBaseline(original, repaired)).not.toThrow()
      const restored = reopen(history)
      expect(node(restored, '11')).toMatchObject({ status: 'ready', targetInstanceId: target.pptxInstanceId })
      expect(media(restored, '3')).toEqual(target)
      expect(JSON.stringify(original)).toBe(before)
    })
  })

  it('rejects missing, foreign, invalid and unsupported timing edits atomically against imported source anchors', async () => {
    await withImportedFixture(async ({ presentation }) => {
      const deck = duplicate(presentation)
      const row = node(deck, '11')
      const before = JSON.stringify(deck)
      const commands = [
        { type: 'set-target', targetInstanceId: 'missing-target' },
        { type: 'set-target', targetInstanceId: media(deck, '3', deck.slides[1]).pptxInstanceId },
        { type: 'set-target', targetInstanceId: null },
        { type: 'set-order', order: 0 }, { type: 'set-order', order: -1 },
        { type: 'set-order', order: 3 }, { type: 'set-order', order: 1.5 },
        { type: 'set-order', order: Infinity },
        { type: 'set-duration', durationMs: -1 }, { type: 'set-duration', durationMs: 1.5 },
        { type: 'set-delay', delayMs: -50 }, { type: 'set-delay', delayMs: Infinity },
        { type: 'set-trigger', trigger: 'onHover' },
        { type: 'set-trigger', trigger: 'javascript:alert(1)' },
        { type: 'set-trigger', trigger: 'onClick', script: 'alert(1)' },
        { type: 'set-effect', effect: 'wipe' },
      ]
      for (const command of commands) {
        const operation = { type: 'timing.edit', slideId: deck.slides[0].id,
          definitionId: row.definitionId, nodeLocator: row.nodeLocator, command }
        const operationBefore = JSON.stringify(operation)
        expect(() => applyPresentationProjectionOperation(deck, operation), JSON.stringify(command)).toThrow(TypeError)
        expect(JSON.stringify(deck)).toBe(before)
        expect(JSON.stringify(operation)).toBe(operationBefore)
      }
      const unsupported = timing(deck).unsupported.find((candidate) => candidate.tag === 'cmd')
      expect(unsupported).toBeDefined()
      for (const patch of [
        { slideId: 'foreign-slide' },
        { definitionId: deck.pptxSemantic.instances[media(deck, '2').pptxInstanceId].definitionId },
        { nodeLocator: { ...row.nodeLocator, preconditionHash: '0'.repeat(64) } },
        { nodeLocator: { ...row.nodeLocator, path: [999] } },
        { definitionId: unsupported.definitionId, nodeLocator: unsupported.nodeLocator },
      ]) {
        expect(() => applyPresentationProjectionOperation(deck, {
          type: 'timing.edit', slideId: deck.slides[0].id,
          definitionId: row.definitionId, nodeLocator: row.nodeLocator,
          command: { type: 'set-order', order: 2 }, ...patch,
        })).toThrow(TypeError)
        expect(JSON.stringify(deck)).toBe(before)
      }
    })
  })

  it('rejects unsafe media origins and invalid mixed playback patches without committing valid fields or disturbing siblings', async () => {
    await withImportedFixture(async ({ presentation }) => {
      const edited = reopen(editMedia(presentation, media(presentation, '2'), PLAYBACK))
      const before = JSON.stringify(edited)
      const unsafeTracks = [
        'javascript:alert(1)', 'file:///C:/private/captions.vtt',
        '//blocked.invalid/captions.vtt', 'https://user:secret@blocked.invalid/captions.vtt',
        'data:text/html;base64,PHNjcmlwdD4=', '/uploads/../private.vtt',
      ].map((src) => ({ tracks: [{ ...CAPTIONS[0], src }] }))
      for (const invalid of [
        { startTime: -1 }, { startTime: 3, endTime: 2 },
        { volume: -0.1 }, { volume: 1.1 }, { volume: NaN },
        { poster: 'https://blocked.invalid/poster.png' },
        { poster: 'javascript:alert(1)' }, { poster: '/uploads/../private.png' },
        { src: 'https://blocked.invalid/replacement.wav' },
        { tracks: [{ ...CAPTIONS[0], kind: 'script' }] },
        { tracks: [CAPTIONS[0], { ...CAPTIONS[0], label: 'Second default' }] },
        ...unsafeTracks,
      ]) {
        const patch = { loop: false, volume: 0.6, ...invalid }
        const patchBefore = JSON.stringify(patch)
        expect(() => editMedia(edited, media(edited, '2'), patch), JSON.stringify(invalid)).toThrow(TypeError)
        expect(JSON.stringify(edited)).toBe(before)
        expect(JSON.stringify(patch)).toBe(patchBefore)
      }
      expect(media(edited, '2')).toMatchObject(PLAYBACK)
      expect(media(edited, '3')).toEqual(media(presentation, '3'))
      expect(edited.pptxSemantic.definitions).toEqual(presentation.pptxSemantic.definitions)
    })
  })

  it('persists typed safe navigation through canonical snapshots and renders actionable metadata only for safe action contracts', () => {
    const original = { id: 'safe-actions', slides: [{ id: 'origin', elements: [
      { id: 'navigate', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 40,
        action: { kind: 'slide', slideId: 'destination', label: 'Open details' } },
      { id: 'web', type: 'shape', shape: 'rect', x: 100, y: 0, width: 100, height: 40,
        action: { kind: 'url', url: 'https://example.test/docs', target: 'new' } },
    ] }, { id: 'destination', elements: [] }] }
    const before = JSON.stringify(original)
    const saved = reopen(original)
    const output = rendered(saved)
    const actions = [...output.querySelectorAll('[data-ns-action]')]
      .map((element) => JSON.parse(element.getAttribute('data-ns-action')))
    expect(actions).toEqual(original.slides[0].elements.map((element) => element.action))
    expect(saved.slides[0].elements[0].action.slideId).toBe(saved.slides[1].id)
    expect(JSON.stringify(original)).toBe(before)
  })

  it.each([
    { kind: 'url', url: 'javascript:alert(1)' },
    { kind: 'url', url: 'file:///C:/private/data' },
    { kind: 'url', url: 'data:text/html;base64,PHNjcmlwdD4=' },
    { kind: 'email', url: 'https://example.test/not-email' },
    { kind: 'url', url: 'https://example.test/\nnext' },
    { kind: 'script', url: 'https://example.test/' },
    { kind: 'next', script: 'alert(1)' },
    { kind: 'url', url: 'https://user:pass@example.test' },
    { kind: 'url', url: '//network.invalid/path' },
    { kind: 'url', url: 'https://example.test\\secrets' },
    { kind: 'slide', slideId: ' leading' },
  ])('rejects unsafe action $kind/$url using the real policy without mutating or emitting an executable surface', (action) => {
    const element = { id: 'unsafe', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 40, action }
    const presentation = { id: 'unsafe-actions', slides: [{ id: 'origin', elements: [element] }] }
    const before = JSON.stringify(presentation)
    const rejected = normalizeElementAction(action)
    expect(rejected.action).toBeNull()
    expect(rejected.error).not.toBe('')
    expect(serializeElementAction(action)).toBe('')
    const output = rendered(presentation)
    expect(output.querySelector('[data-ns-action]')).toBeNull()
    expect(output.querySelector('script,iframe,a[href],button')).toBeNull()
    expect(JSON.stringify(presentation)).toBe(before)
  })
})
