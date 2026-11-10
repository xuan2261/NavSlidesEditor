import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import path from 'node:path'
import { apiDeletePresentation, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { expectOriginalPptxHash } from './pptx-import-api-helper.js'
import { EditorPage } from '../pages/editor-page.js'
import {
  home, importFromHome, pinnedSource, selectSlide, selectElement, inspector,
  closeOverlay, savedDeck, history,
} from './pptx-semantic-ui-journey.js'
import { exportProject, reopenFromHome } from './pptx-semantic-navigation-journey.js'

const nodeRequire = createRequire(path.resolve('package.json'))
const { semanticInstances } = nodeRequire('./shared/src/pptx-semantic-records.js')
const { collectSemanticFontRequests } = nodeRequire('./shared/src/pptx-source-font-request.js')
const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const fontMode = process.env.PLAYWRIGHT_PPTX_FONT_MODE || 'unavailable'
if (!['unavailable', 'measured'].includes(fontMode))
  throw new Error('PLAYWRIGHT_PPTX_FONT_MODE must be unavailable or measured')

export function unchangedOthers(before, after, target) {
  const immutable = model => Object.fromEntries(Object.entries(model).filter(([key]) => key !== 'instances'))
  expect(immutable(after.pptxSemantic), 'Definitions, styles, source graph and provenance are immutable')
    .toEqual(immutable(before.pptxSemantic))
  const oldInstances = new Map(semanticInstances(before.pptxSemantic))
  const newInstances = new Map(semanticInstances(after.pptxSemantic))
  expect([...newInstances.keys()].sort()).toEqual([...oldInstances.keys()].sort())
  for (const [id, instance] of oldInstances)
    if (target.timing || id !== target.element.pptxInstanceId) expect(newInstances.get(id), `Untouched occurrence ${id}`).toEqual(instance)
  const strip = deck => deck.slides.map(slide => ({ ...slide,
    ...(target.timing && slide.id === target.slide.id ? { sourceTiming: undefined } : {}),
    elements: slide.elements.filter(element => target.timing || element.id !== target.element.id),
  }))
  expect(strip(after), 'Sibling objects and other slide values remain byte-equivalent JSON').toEqual(strip(before))
}

// Portable projects intentionally omit the server-owned diagnostics report.
// Equalize only screenshot chrome; never alter authored slide geometry or pixels.
const snapshot = locator => locator.screenshot({ animations: 'disabled', caret: 'hide',
  style: '[data-testid="pptx-import-report-panel"] { height: 61px !important; min-height: 61px !important; max-height: 61px !important; box-sizing: border-box !important; overflow: hidden !important; }',
})
async function settleWitness(page, interaction) {
  await closeOverlay(page, interaction)
  await page.getByTestId('canvas-area').focus()
  await page.keyboard.press('Escape')
  const warning = page.getByRole('alert').filter({ hasText: 'Source Fonts Unavailable' })
  if (fontMode === 'unavailable') {
    // The separate unconfigured-font run proves disclosed preview behavior.
    await expect(warning).toBeVisible({ timeout: 30000 })
  } else {
    // The provider resolves fonts for the whole semantic document, not only the
    // visible slide. A genuinely font-free source must not require a fake face.
    const id = new URL(page.url()).pathname.match(/^\/editor\/([^/]+)$/)?.[1]
    expect(id, 'Font readiness requires the actual open presentation').toBeTruthy()
    const deck = await apiGetPresentation(page.request, id)
    const requirements = collectSemanticFontRequests(deck.pptxSemantic)
    expect(requirements.issues, 'Measured witnesses require resolved source declarations').toEqual([])
    // Absence of the warning also describes loading. Require the real completed
    // measurement document and every requested loaded output face, including
    // the positive measurement-document witness for a zero-face source.
    await page.waitForFunction(expected => {
      const faces = [...globalThis.document.fonts].filter(face => /^pptx_table_/.test(face.family))
      const measurementReady = [...globalThis.document.querySelectorAll('iframe[data-pptx-text-measurement]')]
        .some(frame => {
          const document = frame.contentDocument
          if (document?.URL !== 'about:srcdoc' || document.readyState !== 'complete') return false
          const measured = [...document.fonts].filter(face => /^pptx_measured_/.test(face.family))
          return measured.length === expected && measured.every(face => face.status === 'loaded')
        })
      return measurementReady && faces.length === expected && faces.every(face => face.status === 'loaded')
    }, requirements.faces.length, { timeout: 30000 })
    await expect(warning).not.toBeVisible({ timeout: 30000 })
    await expect(page.locator('.slide-canvas [data-pptx-text-layout]:not([data-pptx-text-layout="measured"])'))
      .toHaveCount(0, { timeout: 30000 })
    await expect(page.locator('.slide-canvas [role="alert"]')).toHaveCount(0, { timeout: 30000 })
  }
  await page.evaluate(async () => {
    await globalThis.document.fonts.ready
    await Promise.all([...globalThis.document.querySelectorAll('.slide-canvas img')].map(image => image.decode()))
  })
}
const canvas = page => page.locator('.slide-canvas')

async function witnesses(page, deck, target, interaction) {
  const other = deck.slides.findIndex(slide => slide.id !== target.slide.id)
  let otherPixels
  if (other >= 0) {
    await selectSlide(page, other, interaction)
    await settleWitness(page, interaction)
    otherPixels = await snapshot(canvas(page))
  }
  await selectSlide(page, target.index, interaction)
  await settleWitness(page, interaction)
  const sibling = target.slide.elements.find(element => element.id !== target.element.id &&
    element.width > 0 && element.height > 0 && !element.hidden)
  expect(sibling, 'A real untouched rendered sibling is required').toBeTruthy()
  const siblingView = page.getByTestId(`slide-element-${sibling.id}`)
  await expect(siblingView).toBeVisible()
  return { other, otherPixels, siblingId: sibling.id, siblingPixels: await snapshot(siblingView) }
}

async function assertWitnesses(page, witness, target, interaction) {
  await settleWitness(page, interaction)
  expect(await snapshot(page.getByTestId(`slide-element-${witness.siblingId}`)), 'Untouched sibling rendered region')
    .toEqual(witness.siblingPixels)
  if (witness.other >= 0) {
    await selectSlide(page, witness.other, interaction)
    await settleWitness(page, interaction)
    expect(await snapshot(canvas(page)), 'Untouched slide rendered region').toEqual(witness.otherPixels)
    await selectSlide(page, target.index, interaction)
  }
}

export async function runJourney({ page, request, info, journey, interaction, theme }) {
  const owned = [], failures = [], saves = []
  let testError
  const sourceFile = await pinnedSource(journey.source)
  try {
    await page.addInitScript(themeValue => {
      globalThis.localStorage.setItem('navSlidesTutorialSeen', 'true')
      globalThis.localStorage.setItem('editor-theme', themeValue)
    }, theme)
    await home(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const id = await importFromHome(page, sourceFile, page.getByTestId('home-import-pptx-input'), owned, interaction)
    const before = await apiGetPresentation(request, id)
    const target = journey.target(before)
    expect(target.element.pptxInstanceId, 'A flattened preview is not typed semantic editing').toBeTruthy()
    await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
    const witness = await witnesses(page, before, target, interaction)
    await selectElement(page, target, interaction)
    const panel = await inspector(page, interaction)
    // Prerequisite conversions are explicit UI commands, saved independently of
    // the operation under test so Undo cannot accidentally undo a conversion.
    if (journey.prepare) {
      await journey.prepare({ page, panel, target, interaction })
      const prepared = await savedDeck(page, request, id, interaction)
      saves.push(prepared.receipt)
    }
    const operations = journey.operations || [journey]
    let edited, finalPriorTarget
    for (const operation of operations) {
      await selectSlide(page, target.index, interaction)
      await selectElement(page, journey.target(await apiGetPresentation(request, id)), interaction)
      let controls = await inspector(page, interaction)
      if (operation.prepare && operation !== journey) {
        await operation.prepare({ page, panel: controls, target: journey.target(await apiGetPresentation(request, id)), interaction })
        const prepared = await savedDeck(page, request, id, interaction)
        saves.push({ operation: operation.id, phase: 'prepare', ...prepared.receipt })
        controls = await inspector(page, interaction)
      }
      const prior = await apiGetPresentation(request, id)
      const priorTarget = journey.target(prior)
      finalPriorTarget = priorTarget
      await operation.edit({ page, panel: controls, target: priorTarget, interaction })
      await closeOverlay(page, interaction)
      edited = await savedDeck(page, request, id, interaction)
      saves.push({ operation: operation.id, phase: 'edit', ...edited.receipt })
      await operation.assert(edited.deck, priorTarget)
      expect({ semantic: edited.deck.pptxSemantic, slides: edited.deck.slides },
        `${operation.id} must commit a real semantic change`).not.toEqual({ semantic: prior.pptxSemantic, slides: prior.slides })
      unchangedOthers(before, edited.deck, target)
      await operation.visible({ page, target: journey.target(edited.deck), interaction })
      await assertWitnesses(page, witness, target, interaction)
      await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
      await pinnedSource(journey.source)
      // Session history must be exercised before reload seeds a new history stack.
      await history(page, 'Undo', interaction)
      const undone = await savedDeck(page, request, id, interaction)
      saves.push({ operation: operation.id, phase: 'undo', ...undone.receipt })
      expect(undone.deck.pptxSemantic, `${operation.id} Undo semantic state`).toEqual(prior.pptxSemantic)
      expect(undone.deck.slides, `${operation.id} Undo slides`).toEqual(prior.slides)
      unchangedOthers(before, undone.deck, target)
      await assertWitnesses(page, witness, target, interaction)
      await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
      await pinnedSource(journey.source)
      await history(page, 'Redo', interaction)
      const redone = await savedDeck(page, request, id, interaction)
      saves.push({ operation: operation.id, phase: 'redo', ...redone.receipt })
      expect(redone.deck.pptxSemantic, `${operation.id} Redo semantic state`).toEqual(edited.deck.pptxSemantic)
      expect(redone.deck.slides, `${operation.id} Redo slides`).toEqual(edited.deck.slides)
      await operation.assert(redone.deck, priorTarget)
      unchangedOthers(before, redone.deck, target)
      await operation.visible({ page, target: journey.target(redone.deck), interaction })
      await assertWitnesses(page, witness, target, interaction)
      await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
      await pinnedSource(journey.source)
      await page.reload()
      await expect(page.getByTestId('canvas-area')).toBeVisible({ timeout: 60000 })
      await selectSlide(page, target.index, interaction)
      const reopened = await apiGetPresentation(request, id)
      expect(reopened.pptxSemantic).toEqual(edited.deck.pptxSemantic)
      expect(reopened.slides).toEqual(edited.deck.slides)
      unchangedOthers(before, reopened, target)
      await operation.assert(reopened, priorTarget)
      await operation.visible({ page, target: journey.target(reopened), interaction })
      await assertWitnesses(page, witness, target, interaction)
      await info.attach(`${operation.id}-reopened`, { body: await snapshot(canvas(page)), contentType: 'image/png' })
      await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
      await pinnedSource(journey.source)
      await reopenFromHome(page, edited.deck, interaction)
      const dashboardReopened = await apiGetPresentation(request, id)
      expect(dashboardReopened.pptxSemantic).toEqual(edited.deck.pptxSemantic)
      expect(dashboardReopened.slides).toEqual(edited.deck.slides)
      unchangedOthers(before, dashboardReopened, target)
      await operation.assert(dashboardReopened, priorTarget)
      await selectSlide(page, target.index, interaction)
      await operation.visible({ page, target: journey.target(dashboardReopened), interaction })
      await assertWitnesses(page, witness, target, interaction)
      await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
      await pinnedSource(journey.source)
    }
    await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
    const download = await exportProject(page, interaction)
    const archive = info.outputPath(`${journey.id.replaceAll('.', '-')}.navslides`)
    await download.saveAs(archive)
    await home(page)
    const cloneId = await importFromHome(page, archive, page.locator('input[accept=".navslides,.json"]'), owned, interaction)
    expect(cloneId).not.toBe(id)
    const clone = await apiGetPresentation(request, cloneId)
    expect(clone.pptxSemantic).toEqual(edited.deck.pptxSemantic)
    expect(clone.slides).toEqual(edited.deck.slides)
    unchangedOthers(before, clone, target)
    // Earlier structural operations can intentionally remove an earlier edited
    // cell/node. Exact final-document equality above preserves every retained edit;
    // reassert the final command against its actual pre-command state, not import.
    await operations.at(-1).assert(clone, finalPriorTarget)
    await selectSlide(page, target.index, interaction)
    await operations.at(-1).visible({ page, target: journey.target(clone), interaction })
    await assertWitnesses(page, witness, target, interaction)
    await expectOriginalPptxHash(request, cloneId, journey.source.sha256, MIME)
    const retained = await apiGetPresentation(request, id)
    expect(retained.pptxSemantic).toEqual(edited.deck.pptxSemantic)
    expect(retained.slides).toEqual(edited.deck.slides)
    await expectOriginalPptxHash(request, id, journey.source.sha256, MIME)
    await pinnedSource(journey.source)
    await info.attach('semantic-operation-receipt', { body: Buffer.from(JSON.stringify({
      operation: journey.id, operations: operations.map(operation => operation.id), source: journey.source, theme, interaction, saves,
      fontMode, viewport: page.viewportSize(), sourceId: id, cloneId, target: target.element.pptxInstanceId,
      nativeVisualQualified: false,
    }, null, 2)), contentType: 'application/json' })
    await expect(page.getByTestId(`slide-element-${journey.target(clone).element.id}`)).toBeVisible()
  } catch (error) { testError = error }
  finally {
    for (const id of [...owned].reverse()) {
      try { await apiDeletePresentation(request, id) } catch (error) { failures.push(error) }
    }
  }
  if (testError) {
    if (failures.length) testError.cause = new AggregateError(failures, 'Journey cleanup failed')
    throw testError
  }
  if (failures.length) throw new AggregateError(failures, 'Journey cleanup failed')
}
