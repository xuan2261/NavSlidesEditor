import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchRecoveryChild } from '../../../server/recovery-test-driver.js'
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { generateBrowserAssets, assertArchive, observeDecodedMedia, observeOffline,
  sha256, writeReceipt } from '../helpers/portable-package-browser-evidence.js'
import { executionIdentityGate } from '../helpers/execution-identity-gate.js'

const seedEntry = pathToFileURL(path.join(__dirname, '../helpers/portable-package-browser-child.cjs'))
const restartEntry = pathToFileURL(path.join(__dirname, '../../../server/recovery-test-child.cjs'))
test.describe.configure({ mode: 'serial', retries: 0 })
test.setTimeout(180000)

async function boot(context, root, seed) {
  const child = launchRecoveryChild(seed ? seedEntry : restartEntry, root, 'restart', { nodeEnv: 'production' })
  try {
    const ready = await child.next('ready')
    const page = await context.newPage()
    await page.addInitScript(() => localStorage.setItem('navSlidesTutorialSeen', 'true'))
    return { child, page, ...ready }
  } catch (error) { await child.kill(); throw error }
}
async function openEditor(runtime, id) {
  await runtime.page.goto(`${runtime.url}/editor/${id}`)
  const editor = new EditorPage(runtime.page)
  await editor.waitForReady()
  return editor
}
async function downloadProject(editor, info, label) {
  const pending = editor.page.waitForEvent('download')
  await editor.menubar.openFileMenuItem('Export Project')
  const download = await pending
  const file = info.outputPath(`${label}.navslides`)
  await download.saveAs(file)
  return file
}
async function openArchive(runtime, file, entrypoint) {
  let priorEditorUrl
  if (entrypoint === 'Home') {
    await runtime.page.goto(runtime.url)
    await runtime.page.locator('input[accept=".navslides,.json"]').setInputFiles(file)
  } else {
    const response = await runtime.page.request.post(`${runtime.url}/api/presentations`, {
      headers: { Origin: runtime.url, Referer: `${runtime.url}/`, 'Sec-Fetch-Site': 'same-origin' },
      data: { title: 'Owned Editor import entrypoint' },
    })
    expect(response.ok()).toBeTruthy()
    const editor = await openEditor(runtime, (await response.json()).id)
    priorEditorUrl = runtime.page.url()
    const chooser = runtime.page.waitForEvent('filechooser')
    await editor.menubar.openFileMenuItem('Open Project')
    await (await chooser).setFiles(file)
  }
  await runtime.page.waitForURL((url) => /\/editor\/[^/]+$/.test(url.pathname) && url.href !== priorEditorUrl)
  const editor = new EditorPage(runtime.page)
  await editor.waitForReady()
  return editor
}
async function fidelityAndOriginal(runtime, originalHash, info, label) {
  const id = new URL(runtime.page.url()).pathname.split('/').at(-1)
  const response = await runtime.page.request.get(`${runtime.url}/api/presentations/${id}/pptx-fidelity`)
  expect(response.ok()).toBeTruthy()
  const contract = await response.json()
  await runtime.page.getByTestId('ribbon-file-menu-trigger').click()
  await expect(runtime.page.getByTestId('pptx-export-original')).toHaveText('Download Original')
  await expect(runtime.page.getByTestId('pptx-export-original')).toBeEnabled()
  const edited = runtime.page.getByTestId('pptx-export-validatedEdited')
  await expect(edited).toHaveText('Export Validated Edited Revision')
  const enabled = contract.exports.validatedEdited.available === true ||
    contract.exports.validatedEdited.reconciliationAvailable === true
  if (enabled) await expect(edited).toBeEnabled()
  else { await expect(edited).toBeDisabled(); await expect(edited).toHaveAttribute('title', /\S+/) }
  const pending = runtime.page.waitForEvent('download')
  await runtime.page.getByTestId('pptx-export-original').click()
  const file = info.outputPath(`${label}-original.pptx`)
  await (await pending).saveAs(file)
  expect(sha256(await readFile(file))).toBe(originalHash)
  return { contract, originalSha256: originalHash, editedAvailabilityObserved: enabled }
}

for (const withMedia of [true, false]) for (const entrypoint of ['Home', 'Editor']) {
  test(`P10-01/12/13/14 ${withMedia ? 'owned media' : 'no local media'} via ${entrypoint} A-B-C`, async ({ context, page }, info) => {
    const roots = []; const runtimes = []
    const receipt = { scenarioIds: ['P10-01', 'P10-12', 'P10-13', 'P10-14'],
      entrypoint, withMedia, status: 'running', observations: [],
      limitations: ['PPTX source seeded with real package store; not parser qualification',
        'Edited availability checked against real host; no fake validator or edited success claim'] }
    try {
      await executionIdentityGate(receipt, 'before', context.browser())
      const assets = withMedia ? await generateBrowserAssets(page) : []
      const rootA = await mkdtemp(path.join(tmpdir(), 'nav-p10-browser-A-')); roots.push(rootA)
      await writeFile(path.join(rootA, 'seed.json'), JSON.stringify({ assets }))
      let runtime = await boot(context, rootA, true); runtimes.push(runtime)
      let editor = await openEditor(runtime, runtime.id)
      const marker = `Saved before export ${randomUUID()}`
      await editor.startEditingTextElement(0); await editor.selectAllText()
      await editor.typeInTextEditor(marker)
      await runtime.page.keyboard.press('Escape')
      // Deliberately no waitForAutoSave: the production Export Project save barrier owns this.
      let file = await downloadProject(editor, info, 'A-export-after-edit')
      receipt.observations.push({ root: 'A', archive: await assertArchive(file, marker, assets, runtime.originalSha256),
        fidelity: await fidelityAndOriginal(runtime, runtime.originalSha256, info, 'A') })
      const originalHash = runtime.originalSha256
      const source = await (await runtime.page.request.get(`${runtime.url}/api/presentations/${runtime.id}`)).json()
      let previousUrls = source.slides[0].elements.filter((el) => el.src).flatMap((el) =>
        [el.src, el.poster, ...(el.tracks || []).map((track) => track.src)].filter(Boolean))
      for (const label of ['B', 'C']) {
        await runtime.page.close(); await runtime.child.kill()
        // Remove the owned previous source root, proving imports cannot consult its bytes.
        await rm(roots.at(-1), { recursive: true, force: true })
        const root = await mkdtemp(path.join(tmpdir(), `nav-p10-browser-${label}-`)); roots.push(root)
        expect(await readdir(root)).toEqual([])
        runtime = await boot(context, root, false); runtimes.push(runtime)
        editor = await openArchive(runtime, file, entrypoint)
        await expect(runtime.page.getByTestId('canvas-area')).toContainText(marker)
        const id = new URL(runtime.page.url()).pathname.split('/').at(-1)
        const canonical = await (await runtime.page.request.get(`${runtime.url}/api/presentations/${id}`)).json()
        expect(canonical.pptxSourceAvailable).toBe(true)
        const urls = canonical.slides[0].elements.filter((el) => el.src).flatMap((el) =>
          [el.src, el.poster, ...(el.tracks || []).map((track) => track.src)].filter(Boolean))
        if (previousUrls && withMedia) for (const url of urls) expect(previousUrls).not.toContain(url)
        previousUrls = urls
        const media = await observeDecodedMedia(runtime.page, withMedia)
        if (withMedia) {
          const hashes = JSON.parse(await readFile(path.join(root, 'data', 'upload-hashes.json'), 'utf8'))
          const records = Object.values(hashes.global || {})
          for (const asset of assets) expect(records).toEqual(expect.arrayContaining([
            expect.objectContaining({ sha256: sha256(Buffer.from(asset.base64, 'base64')), state: 'committed' }),
          ]))
          expect(records.some((record) => record.state === 'pending')).toBe(false)
        }
        await runtime.page.screenshot({ path: info.outputPath(`${label}-editor.png`), fullPage: true })
        const fidelity = await fidelityAndOriginal(runtime, originalHash, info, label)
        file = await downloadProject(editor, info, `${label}-reexport`)
        receipt.observations.push({ root: label, urls, media, fidelity,
          archive: await assertArchive(file, marker, assets, originalHash) })
      }
      const pending = runtime.page.waitForEvent('download')
      await editor.menubar.openFileMenuItem('Export Offline HTML')
      const offline = info.outputPath('C-offline.html'); await (await pending).saveAs(offline)
      await runtime.page.close(); await runtime.child.kill()
      await rm(roots.at(-1), { recursive: true, force: true })
      const offlineContext = await context.browser().newContext()
      try { receipt.offline = await observeOffline(await offlineContext.newPage(), offline, withMedia,
        marker, info.outputPath('C-offline-decoded.png')) } finally { await offlineContext.close() }
      await executionIdentityGate(receipt, 'after', context.browser())
      receipt.status = 'passed'
    } catch (error) { receipt.status = 'failed'; receipt.failure = error.stack; throw error }
    finally {
      try {
        for (const runtime of runtimes) { await runtime.page.close().catch(() => {}); await runtime.child.kill() }
        for (const root of roots) await rm(root, { recursive: true, force: true })
      } finally { await writeReceipt(info, receipt, context.browser()) }
    }
  })
}
test('P10-11 legacy plain JSON imports, saves an edit and survives reload', async ({ context }, info) => {
  const root = await mkdtemp(path.join(tmpdir(), 'nav-legacy-json-'))
  const receipt = { scenarioIds: ['P10-11'], status: 'running', observations: [], limitations: ['Legacy JSON compatibility, not package-backed authority or Office qualification'] }
  let runtime
  try {
    await executionIdentityGate(receipt, 'before', context.browser())
    const marker = 'Legacy JSON compatibility π'
    const legacy = { version: '1.1', presentation: { title: marker, theme: 'black', resolution: { width: 960, height: 540 }, slides: [{ id: 'legacy-slide', notes: 'Legacy speaker notes', elements: [{ id: 'legacy-text', type: 'text', x: 100, y: 100, width: 400, height: 80, fontSize: 24, content: `<p>${marker}</p>` }], background: { type: 'color', color: '#101010' } }] } }
    const file = info.outputPath('legacy.navslides.json')
    await writeFile(file, JSON.stringify(legacy))
    runtime = await boot(context, root, false)
    const editor = await openArchive(runtime, file, 'Home')
    const id = new URL(runtime.page.url()).pathname.split('/').at(-1)
    const persisted = async () => (await runtime.page.request.get(`${runtime.url}/api/presentations/${id}`)).json()
    await expect(runtime.page.getByTestId('canvas-area')).toContainText(marker)
    const imported = await persisted()
    expect(imported.slides[0].notes).toBe(legacy.presentation.slides[0].notes)
    expect(imported.slides[0].elements[0]).toMatchObject(legacy.presentation.slides[0].elements[0])
    await runtime.page.getByPlaceholder('Untitled Presentation').fill('Edited legacy JSON')
    await expect.poll(async () => (await persisted()).title).toBe('Edited legacy JSON')
    await runtime.page.reload(); await editor.waitForReady()
    await expect(runtime.page.getByPlaceholder('Untitled Presentation')).toHaveValue('Edited legacy JSON')
    await expect(runtime.page.getByTestId('canvas-area')).toContainText(marker)
    expect((await persisted()).slides).toEqual(imported.slides)
    await runtime.page.screenshot({ path: info.outputPath('legacy-json-reloaded.png'), fullPage: true })
    receipt.observations.push({ importedTitle: imported.title, savedAndReloadedTitle: 'Edited legacy JSON', unchangedSlidesSha256: sha256(Buffer.from(JSON.stringify(imported.slides))) })
    await executionIdentityGate(receipt, 'after', context.browser()); receipt.status = 'passed'
  } catch (error) { receipt.status = 'failed'; receipt.failure = error.stack; throw error }
  finally {
    try { if (runtime) { await runtime.page.close(); await runtime.child.kill() }; await rm(root, { recursive: true, force: true }) }
    finally { await writeReceipt(info, receipt, context.browser()) }
  }
})
