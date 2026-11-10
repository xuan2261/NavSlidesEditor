import { expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { PNG } from 'pngjs'
import {
  closeOverlay, fillField, inspector, savedDeck, selectElement,
} from './pptx-semantic-ui-journey.js'
import { unchangedOthers } from './pptx-semantic-lifecycle-journey.js'

const nodeRequire = createRequire(path.resolve('package.json'))
const { semanticInstance, semanticDefinition } = nodeRequire('./shared/src/pptx-semantic-records.js')
const { materializePicture } = nodeRequire('./shared/src/pptx-picture-document.js')
const { pictureAsset, occurrencePictureReplacement } = nodeRequire('./shared/src/pptx-picture-replacement.js')
export const source = {
  id: 'background-image-notes-footer.pptx',
  path: 'server/data/test-corpus/background-image-notes-footer.pptx',
  sha256: '1e80dba1ca8f7411858147ade13d206b8253a2ccc72bec1898fca1d77910c74e',
  provenance: 'corpus-picture',
}
export const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export function replacementFile() {
  const png = new PNG({ width: 64, height: 36 })
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const offset = (y * png.width + x) * 4
    const color = (x < 32) !== (y < 18) ? [235, 25, 145, 255] : [20, 225, 80, 255]
    png.data.set(color, offset)
  }
  return { name: 'semantic-whole-picture-replacement.png', mimeType: 'image/png', buffer: PNG.sync.write(png) }
}
export function targetFor(deck, id) {
  const slide = deck.slides[0]
  const element = slide.elements.find(item => id ? item.id === id : item.type === 'image' && item.pptxInstanceId)
  expect(element, 'Real source-bound picture occurrence').toBeTruthy()
  expect(element.pptxInstanceId).toBeTruthy()
  return { index: 0, slide, element }
}
export function stateFor(deck, target) {
  const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
  const definition = semanticDefinition(deck.pptxSemantic, instance.definitionId)
  expect(definition.content.pictureDocument, 'Native source picture declaration').toBeTruthy()
  return { instance, definition, picture: materializePicture(definition, instance),
    replacement: occurrencePictureReplacement(definition, instance), asset: pictureAsset(definition, instance) }
}
export async function selectPicture(page, target, interaction) {
  if (interaction === 'keyboard') return selectElement(page, target, interaction)
  const view = page.getByTestId(`slide-element-${target.element.id}`)
  // The genuine picture is a full-bleed background: its centre is covered by authored text/shapes.
  await view.click({ position: { x: 3, y: 3 } })
  await expect(view).toHaveAttribute('data-selected', 'true')
  return view
}
async function placePicture(page, target, interaction, x) {
  await selectPicture(page, target, interaction)
  const panel = await inspector(page, interaction)
  for (const [name, value] of [['Width', 480], ['Height', 270], ['Horizontal position', x], ['Vertical position', 40]])
    await fillField(panel.getByRole('spinbutton', { name, exact: true }), value, interaction)
  await closeOverlay(page, interaction)
}
export async function prepareSharedPictures(page, request, id, imported, interaction, saves) {
  const original = targetFor(imported)
  expect(imported.slides[0].elements.filter(item => item.type === 'image')).toHaveLength(1)
  // Put the witnesses side by side through actual properties controls so neither can mask the other.
  // These preparatory layout edits and duplication are committed before the replacement baseline.
  await placePicture(page, original, interaction, 40)
  await selectPicture(page, original, interaction)
  await page.getByTestId('canvas-area').focus()
  await page.keyboard.press('ControlOrMeta+d')
  await expect(page.getByTestId(/^slide-element-/).filter({ has: page.locator('svg[data-pptx-picture]') })).toHaveCount(2)
  const duplicated = await savedDeck(page, request, id, interaction)
  saves.push(duplicated.receipt)
  const pictures = duplicated.deck.slides[0].elements.filter(item => item.type === 'image')
  expect(pictures).toHaveLength(2)
  const sibling = targetFor(duplicated.deck, pictures.find(item => item.id !== original.element.id).id)
  await placePicture(page, sibling, interaction, 740)
  const prepared = await savedDeck(page, request, id, interaction)
  saves.push(prepared.receipt)
  const target = targetFor(prepared.deck, original.element.id)
  const shared = targetFor(prepared.deck, sibling.element.id)
  const a = stateFor(prepared.deck, target), b = stateFor(prepared.deck, shared)
  expect(shared.element.pptxInstanceId).not.toBe(target.element.pptxInstanceId)
  expect(b.instance.definitionId, 'Duplicate retains the exact shared source definition').toBe(a.instance.definitionId)
  expect(b.asset).toEqual(a.asset)
  expect(b.picture.mediaBinding).toEqual(a.picture.mediaBinding)
  expect(a.replacement).toBeNull()
  expect(b.replacement).toBeNull()
  return { baseline: prepared.deck, target, sibling: shared }
}
export function assertReplacement(baseline, after, target, receipt) {
  unchangedOthers(baseline, after, target)
  const before = stateFor(baseline, target)
  const currentTarget = targetFor(after, target.element.id)
  const current = stateFor(after, currentTarget)
  expect(current.replacement).toEqual(receipt)
  expect(current.picture, 'Crop, alpha and authored media binding survive whole-image replacement').toEqual(before.picture)
  const expected = structuredClone(before.instance)
  const componentId = before.picture.componentId
  expected.overrides.components = { ...expected.overrides.components }
  const component = expected.overrides.components[componentId] || {}
  expected.overrides.components[componentId] = { ...component,
    picture: { ...component.picture, replacement: receipt } }
  expect(current.instance, 'Only the selected occurrence replacement binding changes').toEqual(expected)
  const asset = { src: `/uploads/${receipt.filename}`, sha256: receipt.sha256, width: receipt.width, height: receipt.height }
  expect(current.asset).toEqual(asset)
  expect(currentTarget.element.src).toBe(asset.src)
  const stripAsset = ({ src: _src, pptxPictureAsset: _asset, ...element }) => element
  expect(stripAsset(currentTarget.element), 'Target geometry and other component values are untouched')
    .toEqual(stripAsset(target.element))
}
export async function renderedPictures(page, request, deck, target, sibling, interaction) {
  await closeOverlay(page, interaction)
  await page.getByTestId('canvas-area').focus()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId(/^slide-element-/).filter({ has: page.locator('svg[data-pptx-picture]') }))
    .not.toHaveCount(0)
  const result = {}
  for (const [name, original] of [['target', target], ['sibling', sibling]]) {
    const current = targetFor(deck, original.element.id), state = stateFor(deck, current)
    const wrapper = page.getByTestId(`slide-element-${current.element.id}`)
    await expect(wrapper).toHaveAttribute('data-selected', 'false')
    const svg = wrapper.locator('svg[data-pptx-picture]')
    await expect(svg).toBeVisible()
    const image = svg.locator('image').first()
    await expect(image).toHaveAttribute('href', state.asset.src)
    const dimensions = await image.evaluate(async node => {
      const decoded = new Image()
      decoded.src = node.getAttribute('href')
      await decoded.decode()
      return { width: decoded.naturalWidth, height: decoded.naturalHeight }
    })
    expect(dimensions).toEqual({ width: state.asset.width, height: state.asset.height })
    const response = await request.get(state.asset.src)
    expect(response.ok(), `Real rendered ${name} resource HTTP ${response.status()}`).toBe(true)
    const bytes = await response.body()
    expect(hash(bytes), `${name} resource bytes match canonical identity`).toBe(state.asset.sha256)
    const rawPng = await svg.screenshot({ animations: 'disabled', caret: 'hide' })
    const decoded = PNG.sync.read(rawPng)
    result[name] = {
      width: decoded.width,
      height: decoded.height,
      pixels: decoded.data,
      png: rawPng,
      asset: state.asset,
      sha256: hash(bytes),
    }
  }
  return result
}
export function samePictures(actual, expected) {
  expect(actual.target.width, 'Target width matches').toBe(expected.target.width)
  expect(actual.target.height, 'Target height matches').toBe(expected.target.height)
  expect(actual.target.asset, 'Target asset matches').toEqual(expected.target.asset)
  expect(actual.target.sha256, 'Target resource SHA-256 matches').toBe(expected.target.sha256)

  let targetDiffCount = 0, targetMaxDelta = 0
  for (let i = 0; i < actual.target.pixels.length; i += 4) {
    const delta = Math.max(
      Math.abs(actual.target.pixels[i] - expected.target.pixels[i]),
      Math.abs(actual.target.pixels[i + 1] - expected.target.pixels[i + 1]),
      Math.abs(actual.target.pixels[i + 2] - expected.target.pixels[i + 2]),
      Math.abs(actual.target.pixels[i + 3] - expected.target.pixels[i + 3])
    )
    if (delta > 0) {
      targetDiffCount++
      if (delta > targetMaxDelta) targetMaxDelta = delta
    }
  }
  expect(targetMaxDelta, 'Target raster color channel delta within subpixel anti-aliasing tolerance').toBeLessThanOrEqual(2)
  expect(targetDiffCount / (actual.target.pixels.length / 4), 'Target anti-aliasing pixel diff ratio').toBeLessThanOrEqual(0.005)

  expect(actual.sibling.width, 'Sibling width matches').toBe(expected.sibling.width)
  expect(actual.sibling.height, 'Sibling height matches').toBe(expected.sibling.height)
  expect(actual.sibling.asset, 'Sibling asset matches').toEqual(expected.sibling.asset)
  expect(actual.sibling.sha256, 'Sibling resource SHA-256 matches').toBe(expected.sibling.sha256)

  let siblingDiffCount = 0, siblingMaxDelta = 0
  for (let i = 0; i < actual.sibling.pixels.length; i += 4) {
    const delta = Math.max(
      Math.abs(actual.sibling.pixels[i] - expected.sibling.pixels[i]),
      Math.abs(actual.sibling.pixels[i + 1] - expected.sibling.pixels[i + 1]),
      Math.abs(actual.sibling.pixels[i + 2] - expected.sibling.pixels[i + 2]),
      Math.abs(actual.sibling.pixels[i + 3] - expected.sibling.pixels[i + 3])
    )
    if (delta > 0) {
      siblingDiffCount++
      if (delta > siblingMaxDelta) siblingMaxDelta = delta
    }
  }
  expect(siblingMaxDelta, 'Sibling raster color channel delta within subpixel anti-aliasing tolerance').toBeLessThanOrEqual(2)
  expect(siblingDiffCount / (actual.sibling.pixels.length / 4), 'Sibling anti-aliasing pixel diff ratio').toBeLessThanOrEqual(0.005)
}
