import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import path from 'node:path'
import { activate, closeOverlay, fillField, selectOption } from './pptx-semantic-ui-journey.js'

const nodeRequire = createRequire(path.resolve('package.json'))
const { semanticInstance, semanticDefinition } = nodeRequire('./shared/src/pptx-semantic-records.js')
const { materializePicture } = nodeRequire('./shared/src/pptx-picture-document.js')
const { resolveSlideTiming, activeTarget } = nodeRequire('./shared/src/pptx-timing-document.js')
const { materializeGeometry } = nodeRequire('./shared/src/pptx-geometry-style-resolution.js')

const geometrySource = {
  id: 'resume-compound-budget-native-1cafc6d5-ea89-48cd-acdd-ff9583d6ba3b/native-compound-budget-scene.pptx',
  path: '.omo/evidence/pptx-semantic/resume-compound-budget-native-1cafc6d5-ea89-48cd-acdd-ff9583d6ba3b/native-compound-budget-scene.pptx',
  sha256: '5b615181a6712ef2cf95d87134882e26c35be4a74e0809e84cbe26197f992161',
  provenance: 'native-rendered-powerpoint-16-scene',
}

const pictureSource = {
  id: 'background-image-notes-footer.pptx',
  path: 'server/data/test-corpus/background-image-notes-footer.pptx',
  sha256: '1e80dba1ca8f7411858147ade13d206b8253a2ccc72bec1898fca1d77910c74e',
  provenance: 'corpus-picture',
}

const inheritanceSource = {
  id: 'STTre_Duc.pptx',
  path: 'server/data/test-corpus/STTre_Duc.pptx',
  sha256: 'a68431f7d42ad92c410b5db67d06ce548c581312ea3b57ae83767c9650afc2c6',
  provenance: 'genuine-corpus-deck',
}

const timingSource = {
  id: 'Bai_2_1.pptx',
  path: 'server/data/test-corpus/Bai_2_1.pptx',
  sha256: 'c883745a73a3a75dbbac0aabf1f3b052543c8cbb12cb0302955d84532c957150',
  provenance: 'genuine-corpus-deck',
}

const inheritanceMarker = 'Occurrence inherited text edit'

export const geometryStrokeCapOperation = {
  id: 'geometry.stroke-cap',
  async edit({ panel, interaction }) {
    const select = panel.getByRole('combobox', { name: 'Native stroke cap', exact: true })
    await selectOption(select, 'rnd', interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const geometry = materializeGeometry(deck.pptxSemantic, target.element.pptxInstanceId)
    expect(geometry.style.stroke.cap, 'Resolved occurrence stroke cap').toBe('rnd')
    expect(instance.overrides.components?.[geometry.componentId]?.geometryStyle?.stroke?.cap,
      'Persisted source-component stroke cap').toBe('rnd')
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const geometryTransformOperation = {
  id: 'geometry.rotation',
  async edit({ panel, interaction }) {
    const rot = panel.getByRole('spinbutton', { name: 'Rotation', exact: true })
    await fillField(rot, 45, interaction)
  },
  assert(deck, target) {
    const el = deck.slides[target.index].elements.find(e => e.id === target.element.id)
    expect(el.rotation).toBe(45)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const geometryJourney = {
  id: 'geometry.composite',
  family: 'geometry',
  source: geometrySource,
  target(deck) {
    const index = 0
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.type === 'shape' && item.pptxInstanceId)
    expect(element, 'Authored custom geometry shape on slide 1').toBeTruthy()
    return { index, slide, element }
  },
  operations: [geometryStrokeCapOperation, geometryTransformOperation],
}

export const pictureCropOperation = {
  id: 'image.crop',
  async edit({ panel, interaction }) {
    const field = panel.getByRole('spinbutton', { name: 'Picture crop left (%)', exact: true })
    await fillField(field, 0.5, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const definition = semanticDefinition(deck.pptxSemantic, instance.definitionId)
    const picture = materializePicture(definition, instance)
    expect(instance.overrides.components?.[picture.componentId]?.picture?.srcRect?.l).toBe(500)
    expect(picture.srcRect.l).toBe(500)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const pictureEffectsOperation = {
  id: 'image.effects',
  async edit({ panel, interaction }) {
    const chk = panel.getByRole('checkbox', { name: 'Invert picture colors', exact: true })
    if (interaction === 'pointer') await chk.click()
    else { await chk.focus(); await chk.press('Space') }
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const definition = semanticDefinition(deck.pptxSemantic, instance.definitionId)
    const picture = materializePicture(definition, instance)
    expect(instance.overrides.components?.[picture.componentId]?.picture?.filters).toEqual([{ kind: 'inv' }])
    expect(picture.filters).toEqual([{ kind: 'inv' }])
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const pictureJourney = {
  id: 'image.composite',
  family: 'image',
  source: pictureSource,
  target(deck) {
    const index = 0
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.type === 'image' && item.pptxInstanceId)
    expect(element, 'Source picture on slide 1').toBeTruthy()
    return { index, slide, element, pointerPosition: { x: 3, y: 3 } }
  },
  operations: [pictureCropOperation, pictureEffectsOperation],
}

export const inheritanceJourney = {
  id: 'text.inheritance',
  family: 'text',
  source: inheritanceSource,
  target(deck) {
    const index = 0
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.pptxInstanceId)
    expect(element, 'Inherited slide 1 element').toBeTruthy()
    return { index, slide, element }
  },
  async edit({ panel, interaction }) {
    const section = panel.getByRole('region', { name: 'Source-bound PPTX text', exact: true })
    const run = section.getByRole('textbox', { name: 'PPTX text paragraph 1 run 1', exact: true })
    await fillField(run, inheritanceMarker, interaction)
    await activate(section.getByRole('button', { name: 'Apply to selected occurrence', exact: true }), interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const textDocument = instance.overrides.components?.[Object.keys(instance.overrides.components)[0]]?.textDocument
    expect(textDocument.paragraphs[0].runs[0].text).toBe(inheritanceMarker)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toContainText(inheritanceMarker)
  },
}

export const timingTriggerOperation = {
  id: 'timing.trigger',
  async edit({ page, interaction }) {
    await closeOverlay(page, interaction)
    await activate(page.getByRole('tab', { name: 'View', exact: true }), interaction)
    const timeline = page.getByRole('button', { name: 'Animation Timeline', exact: true })
    await activate(timeline, interaction)
    const section = page.getByRole('region', { name: 'Native source timing', exact: true })
    const trigger = section.getByRole('combobox', { name: 'Source timing 1 trigger', exact: true })
    await selectOption(trigger, 'withPrevious', interaction)
  },
  assert(deck, target) {
    const priorNode = target.timingNodes[0]
    const node = resolveSlideTiming(deck.pptxSemantic, deck.slides[target.index]).nodes.find(candidate =>
      candidate.definitionId === priorNode.definitionId &&
      JSON.stringify(candidate.nodeLocator) === JSON.stringify(priorNode.nodeLocator))
    expect(node, 'The exact edited source timing node survives').toBeTruthy()
    expect(node.trigger).toBe('withPrevious')
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const timingTargetOperation = {
  id: 'timing.target',
  async edit({ page, target, interaction }) {
    await closeOverlay(page, interaction)
    await activate(page.getByRole('tab', { name: 'View', exact: true }), interaction)
    const timeline = page.getByRole('button', { name: 'Animation Timeline', exact: true })
    await activate(timeline, interaction)
    const section = page.getByRole('region', { name: 'Native source timing', exact: true })
    const targetSelect = section.getByRole('combobox', { name: 'Source timing 1 target', exact: true })
    const current = await targetSelect.inputValue()
    const replacement = target.retargetInstanceId
    expect(replacement, 'A different real same-source timing target is required').toBeTruthy()
    expect(replacement).not.toBe(current)
    await selectOption(targetSelect, replacement, interaction)
  },
  assert(deck, target) {
    const slide = deck.slides[target.index]
    const priorNode = target.timingNodes[0]
    const node = resolveSlideTiming(deck.pptxSemantic, slide).nodes.find(candidate =>
      candidate.definitionId === priorNode.definitionId &&
      JSON.stringify(candidate.nodeLocator) === JSON.stringify(priorNode.nodeLocator))
    expect(node, 'The exact edited source timing node survives').toBeTruthy()
    expect(node.targetInstanceId).toBe(target.retargetInstanceId)
    expect(node.targetInstanceId).not.toBe(priorNode.targetInstanceId)
    expect(node.status).toBe('ready')
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const timingJourney = {
  id: 'timing.composite',
  family: 'timing',
  source: timingSource,
  target(deck) {
    const index = 0
    const slide = deck.slides[index]
    const element = slide?.elements[0]
    expect(element, 'Slide 1 witness element').toBeTruthy()
    const timingNodes = resolveSlideTiming(deck.pptxSemantic, slide).nodes
    expect(timingNodes.length, 'Real source timing nodes on pinned slide 1').toBeGreaterThan(0)
    const first = timingNodes[0]
    const partUri = semanticDefinition(deck.pptxSemantic, first.definitionId).source.partUri
    const retarget = slide.elements.find(item => item.pptxInstanceId !== first.targetInstanceId &&
      activeTarget(deck.pptxSemantic, slide, item.pptxInstanceId, partUri))
    expect(retarget, 'Pinned source must offer a second same-source timing target').toBeTruthy()
    return { index, slide, element, timing: true, timingNodes, retargetInstanceId: retarget.pptxInstanceId }
  },
  operations: [timingTriggerOperation, timingTargetOperation],
}
