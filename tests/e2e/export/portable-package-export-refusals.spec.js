import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchRecoveryChild } from '../../../server/recovery-test-driver.js'
import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { generateBrowserAssets, writeReceipt } from '../helpers/portable-package-browser-evidence.js'
import { executionIdentityGate } from '../helpers/execution-identity-gate.js'
const seedEntry = pathToFileURL(path.join(__dirname, '../helpers/portable-package-browser-child.cjs'))
test.describe.configure({ mode: 'serial', retries: 0 })
test.setTimeout(90000)

for (const failure of ['missing owned media', 'save generation conflict']) {
  test(`P10-15 refuses package export with ${failure}`, async ({ context, page }, info) => {
    let root
    const receipt = { scenarioIds: ['P10-15'], failure, status: 'running', downloads: [] }
    let child; let editorPage
    try {
      await executionIdentityGate(receipt, 'before', context.browser())
      root = await mkdtemp(path.join(tmpdir(), 'nav-p10-browser-refusal-'))
      const assets = await generateBrowserAssets(page)
      await writeFile(path.join(root, 'seed.json'), JSON.stringify({ assets }))
      child = launchRecoveryChild(seedEntry, root, 'restart', { nodeEnv: 'production' })
      const runtime = await child.next('ready')
      editorPage = await context.newPage()
      await editorPage.addInitScript(() => localStorage.setItem('navSlidesTutorialSeen', 'true'))
      await editorPage.goto(`${runtime.url}/editor/${runtime.id}`)
      const editor = new EditorPage(editorPage); await editor.waitForReady()
      const endpoint = `${runtime.url}/api/presentations/${runtime.id}`
      const snapshot = await (await editorPage.request.get(endpoint)).json()
      editorPage.on('download', (download) => receipt.downloads.push(download.suggestedFilename()))
      if (failure === 'missing owned media') {
        // Remove only this test's actual owned image, not unrelated user data.
        const src = snapshot.slides[0].elements.find((el) => el.type === 'image').src
        await unlink(path.join(root, 'uploads', path.basename(src)))
      } else {
        // A real competing save advances authority; the open Editor retains its stale generation.
        const response = await editorPage.request.put(endpoint, {
          headers: { Origin: runtime.url, Referer: `${runtime.url}/`, 'Sec-Fetch-Site': 'same-origin' },
          data: { ...snapshot, title: 'Actual competing save', idempotencyKey: randomUUID() },
        })
        expect(response.ok()).toBeTruthy()
        const remote = await response.json()
        expect(remote.aggregateGeneration).toBeGreaterThan(snapshot.aggregateGeneration)
        receipt.remoteGeneration = remote.aggregateGeneration
        await editor.startEditingTextElement(0); await editor.selectAllText()
        await editor.typeInTextEditor('Stale local edit must not export')
        await editorPage.keyboard.press('Escape')
      }
      await editor.menubar.openFileMenuItem('Export Project')
      // Feedback is produced by the actual awaited export/save failure, not intercepted HTTP.
      await expect(editorPage.getByText(/Unable to save current edits before project export|Resolve the save conflict before exporting|Project export failed:/).first()).toBeVisible()
      if (failure === 'save generation conflict') {
        const current = await (await editorPage.request.get(endpoint)).json()
        expect(current.aggregateGeneration).toBe(receipt.remoteGeneration)
        expect(JSON.stringify(current)).not.toContain('Stale local edit must not export')
      }
      expect(receipt.downloads).toEqual([])
      await editorPage.screenshot({ path: info.outputPath('export-refusal.png'), fullPage: true })
      await executionIdentityGate(receipt, 'after', context.browser())
      receipt.status = 'passed'
    } catch (error) { receipt.status = 'failed'; receipt.error = error.stack; throw error }
    finally {
      try {
        await editorPage?.close().catch(() => {})
        if (child) await child.kill()
        if (root) await rm(root, { recursive: true, force: true })
      } finally { await writeReceipt(info, receipt, context.browser()) }
    }
  })
}
