import { URL } from 'node:url'
import { Buffer } from 'node:buffer'
import { expect, test, apiDeletePresentation, apiGetPresentation } from './fixtures/test-fixtures.js'
import { expectOriginalPptxHash } from './helpers/pptx-import-api-helper.js'
import { EditorPage } from './pages/editor-page.js'
import {
  closeOverlay, history, home, importFromHome, inspector, pinnedSource, savedDeck, selectSlide,
} from './helpers/pptx-semantic-ui-journey.js'
import {
  source, hash, replacementFile, targetFor, stateFor, selectPicture, prepareSharedPictures,
  assertReplacement, renderedPictures, samePictures,
} from './helpers/pptx-semantic-picture-replacement-journey.js'

// Task12 gap: crop alone cannot catch replacing a shared definition or a stale uploaded binding.
// This is a real browser upload/import lifecycle, not native-export visual qualification.
test.describe.configure({ mode: 'default', retries: 0 })
const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const environments = [
  { viewport: { width: 1440, height: 1000 }, interaction: 'pointer', theme: 'light' },
  { viewport: { width: 1440, height: 1000 }, interaction: 'keyboard', theme: 'dark' },
  { viewport: { width: 390, height: 844 }, interaction: 'pointer', theme: 'dark' },
  { viewport: { width: 390, height: 844 }, interaction: 'keyboard', theme: 'light' },
]
for (const { viewport, interaction, theme } of environments) {
  test(`genuine shared picture whole-image replacement ${viewport.width}x${viewport.height} ${interaction} ${theme}`,
    async ({ page, request }, info) => {
      test.setTimeout(360000)
      const owned = [], failures = [], saves = []
      let testError
      const sourceFile = await pinnedSource(source)
      const file = replacementFile()
      try {
        await page.setViewportSize(viewport)
        await page.addInitScript(value => {
          globalThis.localStorage.setItem('navSlidesTutorialSeen', 'true')
          globalThis.localStorage.setItem('editor-theme', value)
        }, theme)
        await home(page)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        const id = await importFromHome(page, sourceFile, page.getByTestId('home-import-pptx-input'), owned)
        const imported = await apiGetPresentation(request, id)
        await expectOriginalPptxHash(request, id, source.sha256, MIME)
        await selectSlide(page, 0, interaction)
        const { baseline, target, sibling } = await prepareSharedPictures(page, request, id, imported, interaction, saves)
        const baselinePixels = await renderedPictures(page, request, baseline, target, sibling, interaction)
        expect(baselinePixels.target.asset).toEqual(baselinePixels.sibling.asset)
        await selectPicture(page, target, interaction)
        const panel = await inspector(page, interaction)
        const nativePicture = panel.getByRole('group', { name: 'Native picture', exact: true })
        const input = nativePicture.getByLabel('Replace picture file', { exact: true })
        await expect(input).toBeVisible()
        await expect(input).toBeEnabled()
        if (interaction === 'keyboard') await input.focus()
        const [upload] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === '/api/upload' &&
            response.request().method() === 'POST', { timeout: 60000 }),
          input.setInputFiles(file),
        ])
        expect(upload.ok(), `Picture upload HTTP ${upload.status()}`).toBe(true)
        const uploadBody = await upload.json()
        const receipt = uploadBody.pictureReplacement
        expect(receipt).toEqual({ kind: 'uploaded-picture', presentationId: id,
          filename: expect.stringMatching(/^[a-zA-Z0-9_-]+\.png$/),
          sha256: hash(file.buffer), width: 64, height: 36 })
        expect(uploadBody.url).toBe(`/uploads/${receipt.filename}`)
        await expect(nativePicture.getByRole('button', { name: 'Restore source picture', exact: true })).toBeEnabled()
        await expect(nativePicture.getByRole('alert')).toHaveCount(0)
        await closeOverlay(page, interaction)
        const edited = await savedDeck(page, request, id, interaction)
        saves.push(edited.receipt)
        assertReplacement(baseline, edited.deck, target, receipt)
        expect(receipt.sha256).not.toBe(stateFor(baseline, target).asset.sha256)
        const editPixels = await renderedPictures(page, request, edited.deck, target, sibling, interaction)
        expect(editPixels.target.pixels, 'Actual rendered target pixels change, not just JSON').not.toEqual(baselinePixels.target.pixels)
        expect(editPixels.target.sha256).toBe(hash(file.buffer))
        expect(editPixels.sibling).toEqual(baselinePixels.sibling)
        await expectOriginalPptxHash(request, id, source.sha256, MIME)
        await history(page, 'Undo', interaction)
        const undone = await savedDeck(page, request, id, interaction)
        saves.push(undone.receipt)
        expect(undone.deck.pptxSemantic).toEqual(baseline.pptxSemantic)
        expect(undone.deck.slides).toEqual(baseline.slides)
        samePictures(await renderedPictures(page, request, undone.deck, target, sibling, interaction), baselinePixels)
        await history(page, 'Redo', interaction)
        const redone = await savedDeck(page, request, id, interaction)
        saves.push(redone.receipt)
        expect(redone.deck.pptxSemantic).toEqual(edited.deck.pptxSemantic)
        expect(redone.deck.slides).toEqual(edited.deck.slides)
        assertReplacement(baseline, redone.deck, target, receipt)
        samePictures(await renderedPictures(page, request, redone.deck, target, sibling, interaction), editPixels)
        await page.reload()
        await new EditorPage(page).waitForReady()
        await selectSlide(page, 0, interaction)
        const reopened = await apiGetPresentation(request, id)
        expect(reopened.pptxSemantic).toEqual(edited.deck.pptxSemantic)
        expect(reopened.slides).toEqual(edited.deck.slides)
        assertReplacement(baseline, reopened, target, receipt)
        samePictures(await renderedPictures(page, request, reopened, target, sibling, interaction), editPixels)
        await expectOriginalPptxHash(request, id, source.sha256, MIME)
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 60000 }),
          new EditorPage(page).menubar.exportProject(),
        ])
        expect(download.suggestedFilename()).toMatch(/\.navslides(\.json)?$/)
        const archive = info.outputPath('shared-picture-replacement.navslides')
        await download.saveAs(archive)
        await home(page)
        const cloneId = await importFromHome(page, archive, page.locator('input[accept=".navslides,.json"]'), owned)
        expect(cloneId).not.toBe(id)
        const clone = await apiGetPresentation(request, cloneId)
        const cloneReceipt = stateFor(clone, targetFor(clone, target.element.id)).replacement
        // Ownership must rebind on project import; byte identity and native source authority must not.
        expect(cloneReceipt).toEqual({ ...receipt, presentationId: cloneId,
          filename: expect.stringMatching(/^[a-zA-Z0-9_-]+\.png$/) })
        assertReplacement(baseline, clone, target, cloneReceipt)
        await selectSlide(page, 0, interaction)
        const clonePixels = await renderedPictures(page, request, clone, target, sibling, interaction)
        samePictures(clonePixels, { ...editPixels, target: { ...editPixels.target,
          asset: { ...editPixels.target.asset, src: `/uploads/${cloneReceipt.filename}` } } })
        expect(clonePixels.target.sha256).toBe(editPixels.target.sha256)
        expect(clonePixels.target.asset).toEqual({ ...editPixels.target.asset, src: `/uploads/${cloneReceipt.filename}` })
        await expectOriginalPptxHash(request, cloneId, source.sha256, MIME)
        const sourceAfterClone = await apiGetPresentation(request, id)
        expect(sourceAfterClone.pptxSemantic).toEqual(edited.deck.pptxSemantic)
        expect(sourceAfterClone.slides).toEqual(edited.deck.slides)
        await expectOriginalPptxHash(request, id, source.sha256, MIME)
        await pinnedSource(source)
        await info.attach('picture-replacement-lifecycle', { contentType: 'application/json',
          body: Buffer.from(JSON.stringify({ operation: 'image.replace-shared-occurrence', source,
            viewport, interaction, theme, sourceId: id, cloneId, saves, receipt, cloneReceipt,
            target: target.element.pptxInstanceId, sibling: sibling.element.pptxInstanceId,
            nativeVisualQualified: false }, null, 2)) })
        await info.attach('picture-replacement-target', { body: editPixels.target.png, contentType: 'image/png' })
        await info.attach('picture-replacement-sibling', { body: editPixels.sibling.png, contentType: 'image/png' })
      } catch (error) { testError = error }
      finally {
        for (const id of [...owned].reverse()) {
          try { await apiDeletePresentation(request, id) } catch (error) { failures.push(error) }
        }
      }
      if (testError) {
        if (failures.length) testError.cause = new AggregateError(failures, 'Picture replacement cleanup failed')
        throw testError
      }
      if (failures.length) throw new AggregateError(failures, 'Picture replacement cleanup failed')
    })
}
