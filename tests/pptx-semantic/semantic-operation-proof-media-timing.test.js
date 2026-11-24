// @vitest-environment node
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'vitest'
import { apply, kind, proofSuite, require } from './semantic-operation-proof-helpers.js'
const { resolveSlideTiming } = require('../../shared/src/pptx-timing-document')
const { PNG } = require('pngjs')
// This existing OOXML fixture has two timing nodes and a four-second real WAV.
// It is not the manifest's single-node source-authored-semantic-features fixture.
const proof = proofSuite('semantic-media-timing-fixture.js')
const media = (p, c) => p.slides[0].elements.find(e => e.pptxInstanceId === c.instance.id)
const edit = (c, playback) => apply(c.presentation, { type: 'media.edit', instanceId: c.instance.id,
  componentId: c.definition.content.mediaDocument.embeddedComponentId, command: { type: 'set-playback', playback } })
proof('media.playback-trim', kind('audio'), c => edit(c, {
  startTime: 1.25, endTime: 3, playbackRate: 1.5, loop: true, muted: true, controls: false, volume: 0.35,
}), (p, c) => {
  expect(media(p, c)).toMatchObject({ startTime: 1.25, endTime: 3, playbackRate: 1.5, loop: true, muted: true, controls: false, volume: 0.35 })
  expect(media(p, c).src).toBe(c.definition.content.mediaDocument.asset.src)
  expect(media(p, c).poster).toBe(c.element.poster)
}, c => edit(c, { startTime: 3, endTime: 2 }))
const captions = 'WEBVTT\n\n00:00.000 --> 00:01.000\nAuthored caption\n'
const tracks = [{ src: '/uploads/proof-caption.vtt', srcLang: 'en', label: 'English', kind: 'captions', default: true }]
proof('media.poster-caption', kind('audio'), async c => {
  await writeFile(path.join(c.directory, 'proof-caption.vtt'), captions)
  await writeFile(path.join(c.directory, 'proof-poster.png'), PNG.sync.write({ width: 1, height: 1, data: Buffer.from([100, 150, 200, 255]) }))
  return edit(c, { poster: '/uploads/proof-poster.png', tracks, transcript: 'Typed transcript <not HTML>', audioDescription: 'Diagram narration' })
}, async (p, c) => {
  expect(await readFile(path.join(c.directory, 'proof-caption.vtt'), 'utf8')).toBe(captions)
  expect(PNG.sync.read(await readFile(path.join(c.directory, 'proof-poster.png')))).toMatchObject({ width: 1, height: 1 })
  expect(media(p, c)).toMatchObject({ poster: '/uploads/proof-poster.png', tracks,
    transcript: 'Typed transcript <not HTML>', audioDescription: 'Diagram narration' })
  expect(media(p, c).src).toBe(c.element.src)
  expect(media(p, c).startTime).toBe(c.element.startTime)
  expect(media(p, c).endTime).toBe(c.element.endTime)
}, c => edit(c, { tracks: [{ ...tracks[0], src: 'javascript:alert(1)' }] }))
const timing = p => resolveSlideTiming(p.pptxSemantic, p.slides[0])
const first = p => timing(p).nodes.find(n => n.nativeTimeId === '11')
function editTiming(c, command, p = c.presentation) {
  const node = first(p)
  return apply(p, { type: 'timing.edit', slideId: c.slide.id, definitionId: node.definitionId, nodeLocator: node.nodeLocator, command })
}
proof('timing.order-trigger', kind('audio'), c => {
  const p = editTiming(c, { type: 'set-order', order: 2 })
  return editTiming(c, { type: 'set-trigger', trigger: 'withPrevious' }, p)
}, (p, c) => {
  expect(first(p)).toMatchObject({ order: 2, trigger: 'withPrevious', targetInstanceId: c.instance.id })
  expect(timing(p).nodes.find(n => n.nativeTimeId === '21')).toMatchObject({ order: 1, trigger: 'afterPrevious' })
  expect(first(p).nodeLocator).toEqual(first(c.presentation).nodeLocator)
  expect(first(p).durationMs).toBe(first(c.presentation).durationMs)
}, c => editTiming(c, { type: 'set-order', order: 3 }))
proof('timing.target', kind('audio'), c => {
  const sibling = c.slide.elements.find(e => e.type === 'audio' && e.pptxInstanceId !== c.instance.id)
  expect(sibling).toBeDefined()
  return editTiming(c, { type: 'set-target', targetInstanceId: sibling.pptxInstanceId })
}, (p, c) => {
  const sibling = c.slide.elements.find(e => e.type === 'audio' && e.pptxInstanceId !== c.instance.id)
  expect(first(p).targetInstanceId).toBe(sibling.pptxInstanceId)
  expect(first(p).sourceTarget).toEqual(first(c.presentation).sourceTarget)
  expect(first(p).nodeLocator).toEqual(first(c.presentation).nodeLocator)
  expect(first(p).order).toBe(1)
  expect(timing(p).nodes.find(n => n.nativeTimeId === '21')).toEqual(timing(c.presentation).nodes.find(n => n.nativeTimeId === '21'))
}, c => editTiming(c, { type: 'set-target', targetInstanceId: 'missing-occurrence' }))
