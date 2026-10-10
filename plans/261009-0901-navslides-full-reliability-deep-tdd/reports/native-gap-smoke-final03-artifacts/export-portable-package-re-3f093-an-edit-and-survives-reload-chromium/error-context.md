# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: export\portable-package-real-browser.spec.js >> P10-11 legacy plain JSON imports, saves an edit and survives reload
- Location: tests\e2e\export\portable-package-real-browser.spec.js:161:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "Legacy JSON compatibility π"
Received: "Legacy JSON compatibility π (Imported)"
```

# Test source

```ts
  77  |   const pending = runtime.page.waitForEvent('download')
  78  |   await runtime.page.getByTestId('pptx-export-original').click()
  79  |   const file = info.outputPath(`${label}-original.pptx`)
  80  |   await (await pending).saveAs(file)
  81  |   expect(sha256(await readFile(file))).toBe(originalHash)
  82  |   return { contract, originalSha256: originalHash, editedAvailabilityObserved: enabled }
  83  | }
  84  | 
  85  | for (const withMedia of [true, false]) for (const entrypoint of ['Home', 'Editor']) {
  86  |   test(`P10-01/12/13/14 ${withMedia ? 'owned media' : 'no local media'} via ${entrypoint} A-B-C`, async ({ context, page }, info) => {
  87  |     const roots = []; const runtimes = []
  88  |     const receipt = { scenarioIds: ['P10-01', 'P10-12', 'P10-13', 'P10-14'],
  89  |       entrypoint, withMedia, status: 'running', observations: [],
  90  |       limitations: ['PPTX source seeded with real package store; not parser qualification',
  91  |         'Edited availability checked against real host; no fake validator or edited success claim'] }
  92  |     try {
  93  |       await executionIdentityGate(receipt, 'before', context.browser())
  94  |       const assets = withMedia ? await generateBrowserAssets(page) : []
  95  |       const rootA = await mkdtemp(path.join(tmpdir(), 'nav-p10-browser-A-')); roots.push(rootA)
  96  |       await writeFile(path.join(rootA, 'seed.json'), JSON.stringify({ assets }))
  97  |       let runtime = await boot(context, rootA, true); runtimes.push(runtime)
  98  |       let editor = await openEditor(runtime, runtime.id)
  99  |       const marker = `Saved before export ${randomUUID()}`
  100 |       await editor.startEditingTextElement(0); await editor.selectAllText()
  101 |       await editor.typeInTextEditor(marker)
  102 |       await runtime.page.keyboard.press('Escape')
  103 |       // Deliberately no waitForAutoSave: the production Export Project save barrier owns this.
  104 |       let file = await downloadProject(editor, info, 'A-export-after-edit')
  105 |       receipt.observations.push({ root: 'A', archive: await assertArchive(file, marker, assets, runtime.originalSha256),
  106 |         fidelity: await fidelityAndOriginal(runtime, runtime.originalSha256, info, 'A') })
  107 |       const originalHash = runtime.originalSha256
  108 |       const source = await (await runtime.page.request.get(`${runtime.url}/api/presentations/${runtime.id}`)).json()
  109 |       let previousUrls = source.slides[0].elements.filter((el) => el.src).flatMap((el) =>
  110 |         [el.src, el.poster, ...(el.tracks || []).map((track) => track.src)].filter(Boolean))
  111 |       for (const label of ['B', 'C']) {
  112 |         await runtime.page.close(); await runtime.child.kill()
  113 |         // Remove the owned previous source root, proving imports cannot consult its bytes.
  114 |         await rm(roots.at(-1), { recursive: true, force: true })
  115 |         const root = await mkdtemp(path.join(tmpdir(), `nav-p10-browser-${label}-`)); roots.push(root)
  116 |         expect(await readdir(root)).toEqual([])
  117 |         runtime = await boot(context, root, false); runtimes.push(runtime)
  118 |         editor = await openArchive(runtime, file, entrypoint)
  119 |         await expect(runtime.page.getByTestId('canvas-area')).toContainText(marker)
  120 |         const id = new URL(runtime.page.url()).pathname.split('/').at(-1)
  121 |         const canonical = await (await runtime.page.request.get(`${runtime.url}/api/presentations/${id}`)).json()
  122 |         expect(canonical.pptxSourceAvailable).toBe(true)
  123 |         const urls = canonical.slides[0].elements.filter((el) => el.src).flatMap((el) =>
  124 |           [el.src, el.poster, ...(el.tracks || []).map((track) => track.src)].filter(Boolean))
  125 |         if (previousUrls && withMedia) for (const url of urls) expect(previousUrls).not.toContain(url)
  126 |         previousUrls = urls
  127 |         const media = await observeDecodedMedia(runtime.page, withMedia)
  128 |         if (withMedia) {
  129 |           const hashes = JSON.parse(await readFile(path.join(root, 'data', 'upload-hashes.json'), 'utf8'))
  130 |           const records = Object.values(hashes.global || {})
  131 |           for (const asset of assets) expect(records).toEqual(expect.arrayContaining([
  132 |             expect.objectContaining({ sha256: sha256(Buffer.from(asset.base64, 'base64')), state: 'committed' }),
  133 |           ]))
  134 |           expect(records.some((record) => record.state === 'pending')).toBe(false)
  135 |         }
  136 |         await runtime.page.screenshot({ path: info.outputPath(`${label}-editor.png`), fullPage: true })
  137 |         const fidelity = await fidelityAndOriginal(runtime, originalHash, info, label)
  138 |         file = await downloadProject(editor, info, `${label}-reexport`)
  139 |         receipt.observations.push({ root: label, urls, media, fidelity,
  140 |           archive: await assertArchive(file, marker, assets, originalHash) })
  141 |       }
  142 |       const pending = runtime.page.waitForEvent('download')
  143 |       await editor.menubar.openFileMenuItem('Export Offline HTML')
  144 |       const offline = info.outputPath('C-offline.html'); await (await pending).saveAs(offline)
  145 |       await runtime.page.close(); await runtime.child.kill()
  146 |       await rm(roots.at(-1), { recursive: true, force: true })
  147 |       const offlineContext = await context.browser().newContext()
  148 |       try { receipt.offline = await observeOffline(await offlineContext.newPage(), offline, withMedia,
  149 |         marker, info.outputPath('C-offline-decoded.png')) } finally { await offlineContext.close() }
  150 |       await executionIdentityGate(receipt, 'after', context.browser())
  151 |       receipt.status = 'passed'
  152 |     } catch (error) { receipt.status = 'failed'; receipt.failure = error.stack; throw error }
  153 |     finally {
  154 |       try {
  155 |         for (const runtime of runtimes) { await runtime.page.close().catch(() => {}); await runtime.child.kill() }
  156 |         for (const root of roots) await rm(root, { recursive: true, force: true })
  157 |       } finally { await writeReceipt(info, receipt, context.browser()) }
  158 |     }
  159 |   })
  160 | }
  161 | test('P10-11 legacy plain JSON imports, saves an edit and survives reload', async ({ context }, info) => {
  162 |   const root = await mkdtemp(path.join(tmpdir(), 'nav-legacy-json-'))
  163 |   const receipt = { scenarioIds: ['P10-11'], status: 'running', observations: [], limitations: ['Legacy JSON compatibility, not package-backed authority or Office qualification'] }
  164 |   let runtime
  165 |   try {
  166 |     await executionIdentityGate(receipt, 'before', context.browser())
  167 |     const marker = 'Legacy JSON compatibility π'
  168 |     const legacy = { version: '1.1', presentation: { title: marker, theme: 'black', resolution: { width: 960, height: 540 }, slides: [{ id: 'legacy-slide', notes: 'Legacy speaker notes', elements: [{ id: 'legacy-text', type: 'text', x: 100, y: 100, width: 400, height: 80, fontSize: 24, content: `<p>${marker}</p>` }], background: { type: 'color', color: '#101010' } }] } }
  169 |     const file = info.outputPath('legacy.navslides.json')
  170 |     await writeFile(file, JSON.stringify(legacy))
  171 |     runtime = await boot(context, root, false)
  172 |     const editor = await openArchive(runtime, file, 'Home')
  173 |     const id = new URL(runtime.page.url()).pathname.split('/').at(-1)
  174 |     const persisted = async () => (await runtime.page.request.get(`${runtime.url}/api/presentations/${id}`)).json()
  175 |     await expect(runtime.page.getByTestId('canvas-area')).toContainText(marker)
  176 |     const imported = await persisted()
> 177 |     expect(imported.title).toBe(marker)
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
  178 |     expect(imported.slides[0].notes).toBe(legacy.presentation.slides[0].notes)
  179 |     expect(imported.slides[0].elements[0]).toMatchObject(legacy.presentation.slides[0].elements[0])
  180 |     await runtime.page.getByPlaceholder('Untitled Presentation').fill('Edited legacy JSON')
  181 |     await expect.poll(async () => (await persisted()).title).toBe('Edited legacy JSON')
  182 |     await runtime.page.reload(); await editor.waitForReady()
  183 |     await expect(runtime.page.getByPlaceholder('Untitled Presentation')).toHaveValue('Edited legacy JSON')
  184 |     await expect(runtime.page.getByTestId('canvas-area')).toContainText(marker)
  185 |     expect((await persisted()).slides).toEqual(imported.slides)
  186 |     await runtime.page.screenshot({ path: info.outputPath('legacy-json-reloaded.png'), fullPage: true })
  187 |     receipt.observations.push({ importedTitle: imported.title, savedAndReloadedTitle: 'Edited legacy JSON', unchangedSlidesSha256: sha256(Buffer.from(JSON.stringify(imported.slides))) })
  188 |     await executionIdentityGate(receipt, 'after', context.browser()); receipt.status = 'passed'
  189 |   } catch (error) { receipt.status = 'failed'; receipt.failure = error.stack; throw error }
  190 |   finally {
  191 |     try { if (runtime) { await runtime.page.close(); await runtime.child.kill() }; await rm(root, { recursive: true, force: true }) }
  192 |     finally { await writeReceipt(info, receipt, context.browser()) }
  193 |   }
  194 | })
  195 | 
```