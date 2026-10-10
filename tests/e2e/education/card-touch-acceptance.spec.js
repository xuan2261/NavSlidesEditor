import {
  test,
  expect,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'
import {
  cardDeck,
  images,
  rootFor,
  cards,
  progress,
  concealed,
  decodedImage,
  settledMismatch,
} from './card-image-lifecycle-interactions.js'
import { observedTouch } from './native-touch-observations.js'
import { observe } from './release-observations.js'

for (const surface of ['present', 'file']) {
  test(`native card touch ${surface}: image mismatch locks, exact pairs score once, flashcards conceal backs and navigation/reset preserve studied identity`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    await apiUpdatePresentation(request, testPresentation.id, cardDeck())
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    const saved = await apiGetPresentation(request, testPresentation.id)
    let active, offline, file, touch
    if (surface === 'present') ({ popup: active } = await launchPresentPopup(page))
    else {
      file = await downloadArtifact(page, testInfo, 'Export HTML', 'cards-trusted-touch.html')
      offline = await freshPortable(browser, file)
      active = offline.page
    }
    try {
      await active.setViewportSize({ width: 768, height: 1024 })
      await active.emulateMedia({ reducedMotion: 'reduce' })
      await active.waitForFunction(() => window.Reveal?.isReady())
      touch = await observedTouch(active)
      const memory = rootFor(active, 'parent', 'memory-a'),
        witness = rootFor(active, 'parent', 'memory-b')
      const flash = rootFor(active, 'parent', 'mixed-flash')
      const command = (root, name) => touch.tap(root.getByRole('button', { name, exact: true }))
      const memoryInputs = cards(memory)
      await concealed(memory)
      await touch.tap(memoryInputs.nth(0))
      await decodedImage(memory, images[0], 36, 24)
      await touch.tap(memoryInputs.nth(0))
      await progress(memory, 0, 0, 0)
      await touch.tap(memoryInputs.nth(2))
      await decodedImage(memory, images[1], 28, 32)
      await expect(memoryInputs.nth(1)).toBeDisabled()
      await touch.tap(memoryInputs.nth(1))
      await progress(memory, 0, 1, 0)
      await settledMismatch(memory)
      await concealed(memory)
      await command(memory, 'Reset')
      await touch.tap(memoryInputs.nth(0))
      await touch.tap(memoryInputs.nth(1))
      await progress(memory, 1, 1, 10)
      await touch.tap(memoryInputs.nth(0))
      await progress(memory, 1, 1, 10)
      await touch.tap(memoryInputs.nth(2))
      await touch.tap(memoryInputs.nth(3))
      await progress(memory, 2, 2, 20)
      await expect(memory.locator('[data-ns-card-state="matched"]')).toHaveCount(4)
      await progress(witness, 0, 0, 0)
      const completedMemory = await memory.innerText()
      await command(memory, 'Reset')
      await progress(memory, 0, 0, 0)
      await concealed(memory)

      const output = flash.locator('[data-ns-flashcards-progress]')
      const flip = () => touch.tap(flash.locator('[data-ns-command="flip"]'))
      await decodedImage(flash, images[0], 36, 24)
      expect(await flash.ariaSnapshot()).not.toContain('Amber hidden answer')
      await flip()
      await expect(flash.getByRole('group', { name: 'Card back', exact: true })).toHaveText(
        'Amber hidden answer'
      )
      await expect(output).toHaveText('Card 1 / 2 · 1 / 2 studied')
      await flip()
      await flip()
      await expect(output).toHaveText('Card 1 / 2 · 1 / 2 studied')
      await command(flash, 'Next')
      await expect(flash.getByRole('group', { name: 'Card front', exact: true })).toHaveText(
        'Teal visible question'
      )
      expect(await flash.ariaSnapshot()).not.toContain(images[1].alt)
      await flip()
      await decodedImage(flash, images[1], 28, 32)
      await expect(output).toHaveText('Card 2 / 2 · 2 / 2 studied')
      await command(flash, 'Previous')
      await decodedImage(flash, images[0], 36, 24)
      await expect(output).toHaveText('Card 1 / 2 · 2 / 2 studied')
      await command(flash, 'Shuffle')
      await decodedImage(flash, images[0], 36, 24)
      await expect(output).toHaveText(/Card [12] \/ 2 · 2 \/ 2 studied/)
      const shuffled = await output.textContent()
      await command(flash, 'Reset')
      await expect(output).toHaveText('Card 1 / 2 · 0 / 2 studied')
      await decodedImage(flash, images[0], 36, 24)
      expect(await flash.ariaSnapshot()).not.toContain('Amber hidden answer')
      expect(await active.evaluate(() => window.Reveal.getIndices())).toMatchObject({ h: 0, v: 0 })
      expect(await apiGetPresentation(request, testPresentation.id)).toEqual(saved)
      const inputs = await touch.events(),
        network = offline ? await offline.inspectNetwork() : null
      for (const gameType of ['memory', 'flashcards'])
        await observe(
          testInfo,
          active,
          { element: 'game', gameType, surface },
          surface === 'file' ? 'offline-complete-reset' : 'complete-reset',
          {
            modality: 'trusted touch',
            minimumTargetCssPx: 24,
            memoryScore: 20,
            memoryAttempts: 2,
            studiedCards: 2,
            resetStudiedCards: 0,
            savedConfigUnchanged: true,
          },
          {
            completedMemory,
            shuffled,
            flashReset: await flash.innerText(),
            inputs,
            network,
            savedConfig: saved.slides,
          },
          file ? [file] : []
        )
    } finally {
      try {
        await touch?.close()
      } finally {
        if (offline) await offline.context.close()
        else await active.close()
      }
    }
  })
}
