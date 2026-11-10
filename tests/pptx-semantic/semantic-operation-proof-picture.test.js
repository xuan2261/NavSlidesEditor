// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'vitest'
import { apply, kind, proofSuite, require } from './semantic-operation-proof-helpers.js'
const { PNG } = require('pngjs')

// Source import: semantic-picture-fixture.js, not the manifest feature package.
// Replacement is a real encoded PNG with hash and dimensions read from its bytes.
const proof = proofSuite('semantic-picture-fixture.js')
const picture = (p, c) => p.slides[0].elements.find(e => e.pptxInstanceId === c.instance.id)
const edit = (c, command) => apply(c.presentation, { type: 'picture.edit', instanceId: c.instance.id,
  componentId: c.definition.content.pictureDocument.componentId, command })
proof('image.replace', kind('image'), async c => {
  const bytes = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([36, 104, 172, 255]) })
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  expect(sha256).not.toBe(c.definition.content.media.sha256)
  await writeFile(path.join(c.directory, 'proof-replacement.png'), bytes)
  return edit(c, { type: 'replace', expectedReplacement: null, replacement: {
    kind: 'uploaded-picture', presentationId: c.presentation.id, filename: 'proof-replacement.png', sha256, width: 1, height: 1,
  } })
}, async (p, c) => {
  const bytes = await readFile(path.join(c.directory, 'proof-replacement.png'))
  expect(PNG.sync.read(bytes)).toMatchObject({ width: 1, height: 1, data: Buffer.from([36, 104, 172, 255]) })
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  expect(picture(p, c).src).toBe('/uploads/proof-replacement.png')
  expect(picture(p, c).pptxPictureAsset).toEqual({ src: '/uploads/proof-replacement.png', sha256, width: 1, height: 1 })
  expect(picture(p, c).pptxPicture.mediaBinding).toEqual(c.definition.content.pictureDocument.mediaBinding)
  const restored = apply(p, { type: 'picture.edit', instanceId: c.instance.id,
    componentId: c.definition.content.pictureDocument.componentId, command: { type: 'restore-source',
      expectedReplacement: { kind: 'uploaded-picture', presentationId: c.presentation.id, filename: 'proof-replacement.png', sha256, width: 1, height: 1 } } })
  expect(picture(restored, c).src).toBe(c.element.src)
}, c => edit(c, { type: 'replace', expectedReplacement: null, replacement: {
  kind: 'uploaded-picture', presentationId: 'foreign-presentation', filename: 'proof-replacement.png', sha256: c.definition.content.media.sha256, width: 1, height: 1,
} }))
proof('image.crop', kind('image'), c => edit(c, { type: 'crop', edge: 'l', value: 12500 }), (p, c) => {
  expect(picture(p, c).pptxPicture.srcRect).toEqual({ ...c.definition.content.pictureDocument.srcRect, l: 12500 })
  expect(picture(p, c).pptxPicture.mediaBinding).toEqual(c.definition.content.pictureDocument.mediaBinding)
  expect(picture(p, c).pptxPicture.alpha).toEqual(c.definition.content.pictureDocument.alpha)
}, c => edit(c, { type: 'crop', edge: 'l', value: '12500' }))
proof('image.effects', kind('image'), c => {
  const p = edit(c, { type: 'filters', stages: [{ kind: 'lum', bright: 10000, contrast: -5000 }, { kind: 'inv' }] })
  return apply(p, { type: 'picture.edit', instanceId: c.instance.id, componentId: c.definition.content.pictureDocument.componentId,
    command: { type: 'alpha', stages: [{ kind: 'alphaModFix', amt: 65000 }] } })
}, (p, c) => {
  expect(picture(p, c).pptxPicture.filters).toEqual([{ kind: 'lum', bright: 10000, contrast: -5000 }, { kind: 'inv' }])
  expect(picture(p, c).pptxPicture.alpha).toEqual([{ kind: 'alphaModFix', amt: 65000 }])
  expect(picture(p, c).pptxPicture.srcRect).toEqual(c.definition.content.pictureDocument.srcRect)
}, c => edit(c, { type: 'filters', stages: [{ kind: 'lum', bright: 100001 }] }))
