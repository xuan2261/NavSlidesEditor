import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect, test, apiCreatePresentation, apiDeletePresentation, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { expectOriginalPptxHash, getPptxFidelity } from './pptx-import-api-helper.js'
import { home, importFromHome, pinnedSource, savedDeck, activate, selectSlide } from './pptx-semantic-ui-journey.js'
import { inheritanceJourney, timingJourney } from './pptx-semantic-media-journeys.js'

const MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const quick = page => page.getByRole('toolbar', { name: 'Quick actions', exact: true })

export function registerSemanticNegativeCases() {
for (const [name, diagnostic] of [
  ['bad-crc.pptx', /CRC32 mismatch/i],
  ['malformed-xml.pptx', /DTD is prohibited/i],
]) {
  test(`dashboard safely rejects existing ${name}`, async ({ page, request }) => {
    test.setTimeout(180000)
    const control = await apiCreatePresentation(request, `Rejection control ${name}`)
    try {
      const prior = await apiGetPresentation(request, control.id)
      await home(page)
      const input = page.getByTestId('home-import-pptx-input')
      await input.setInputFiles(path.resolve('server/data/test-corpus/adversarial', name))
      const failure = page.getByTestId('app-feedback-message')
      await expect(failure).toHaveAttribute('role', 'alert', { timeout: 120000 })
      await expect(failure).toContainText(diagnostic)
      expect(new URL(page.url()).pathname).toBe('/')
      await expect(input).toBeEnabled()
      expect(await apiGetPresentation(request, control.id)).toEqual(prior)
    } finally { await apiDeletePresentation(request, control.id) }
  })
}
for (const name of ['macro-ole-stub.pptx', 'nested-package.pptx']) { // Embedded depth0..3 is allowed; maxDepth2 is a separate gate.
test(`dashboard preserves excluded ${name} with Original-only export controls`, async ({ page, request }) => {
  test.setTimeout(180000)
  const file = path.resolve('server/data/test-corpus/adversarial', name)
  const source = { path: file, sha256: sha256(await readFile(file)) }, owned = []
  const executableRequests = []
  page.on('request', request => { if (/\/(?:vbaProject|oleObject)[^/]*\.bin(?:\?|$)/i.test(request.url())) executableRequests.push(request.url()) })
  try {
    const control = await apiCreatePresentation(request, 'Excluded payload prior committed control')
    owned.push(control.id)
    const committed = await apiGetPresentation(request, control.id)
    await home(page)
    const id = await importFromHome(page, await pinnedSource(source), page.getByTestId('home-import-pptx-input'), owned)
    const prior = await apiGetPresentation(request, id)
    const fidelity = await getPptxFidelity(request, id)
    expect(fidelity.fidelity.status).toBe('original-only')
    expect(fidelity.exports.original.available).toBe(true)
    expect(fidelity.exports.validatedEdited.available).toBe(false)
    expect(fidelity.exports.reconstructed.available).toBe(false)
    await page.getByTestId('ribbon-file-menu-trigger').click()
    const panel = page.getByTestId('pptx-fidelity-panel')
    await expect(panel.getByTestId('pptx-fidelity-status')).toHaveText('Original-only fidelity')
    await expect(panel.getByRole('button', { name: 'Download Original', exact: true })).toBeEnabled()
    const edited = panel.getByRole('button', { name: 'Export Validated Edited Revision', exact: true })
    await expect(edited).toBeDisabled()
    await expect(edited).toHaveAttribute('aria-description', fidelity.exports.validatedEdited.reason)
    await expect(panel.getByRole('button', { name: 'Generate Reconstructed PPTX', exact: true })).toBeDisabled()
    await expectOriginalPptxHash(request, id, source.sha256, MIME)
    expect(await apiGetPresentation(request, id)).toEqual(prior)
    expect(await apiGetPresentation(request, control.id)).toEqual(committed)
    expect(executableRequests).toEqual([])
    await pinnedSource(source)
  } finally { for (const id of owned.reverse()) await apiDeletePresentation(request, id) }
})
}
for (const dismissal of ['Cancel', 'Escape']) {
  test(`negative save conflict ${dismissal} preserves the local edit and remote committed content`, async ({ page, request }) => {
    test.setTimeout(180000)
    const source = timingJourney.source, owned = []
    try {
      await home(page)
      const id = await importFromHome(page, await pinnedSource(source), page.getByTestId('home-import-pptx-input'), owned)
      const initial = (await savedDeck(page, request, id, 'pointer')).deck
      // Only the competing remote writer uses API mutation; the local edit and refusal use real UI controls.
      const conflicting = await request.put(`/api/presentations/${id}`, {
        data: { ...initial, title: 'Out of band edit', idempotencyKey: randomUUID() },
        headers: { connection: 'close' },
      })
      expect(conflicting.ok(), await conflicting.text()).toBe(true)
      const remote = await apiGetPresentation(request, id)
      expect(remote.aggregateGeneration).toBeGreaterThan(initial.aggregateGeneration)
      const title = page.getByPlaceholder('Untitled Presentation')
      await title.fill('Local edit retained after refusal')
      const [refusal] = await Promise.all([
        page.waitForResponse(response => response.request().method() === 'PUT' &&
          new URL(response.url()).pathname === `/api/presentations/${id}`, { timeout: 30000 }),
        activate(quick(page).getByRole('button', { name: /^(Save|Saved)$/ }), 'pointer'),
      ])
      expect(refusal.status()).toBe(409)
      expect(await refusal.json()).toMatchObject({ reason: 'STALE_GENERATION' })
      const dialog = page.getByRole('alertdialog', { name: 'Save conflict', exact: true })
      await expect(dialog).toBeVisible()
      for (const name of ['Cancel', 'Use Remote', 'Keep Local'])
        await expect(dialog.getByRole('button', { name, exact: true })).toBeEnabled()
      if (dismissal === 'Escape') await page.keyboard.press('Escape')
      else await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      await expect(title).toHaveValue('Local edit retained after refusal')
      expect(await apiGetPresentation(request, id)).toEqual(remote)
      expect(remote.pptxSemantic).toEqual(initial.pptxSemantic)
      expect(remote.slides).toEqual(initial.slides)
      await expectOriginalPptxHash(request, id, source.sha256, MIME)
      await pinnedSource(source)
    } finally { for (const id of owned.reverse()) await apiDeletePresentation(request, id) }
  })
}

test('negative missing font import disclosure preserves prior committed content and editor controls', async ({ page, request }, info) => {
  test.setTimeout(180000)
  const source = inheritanceJourney.source, owned = []
  try {
    const control = await apiCreatePresentation(request, 'Missing font prior committed control')
    owned.push(control.id)
    const committed = await apiGetPresentation(request, control.id)
    await home(page)
    const profileResponse = page.waitForResponse(response =>
      /\/api\/presentations\/[^/]+\/semantic-fonts\?/.test(response.url()), { timeout: 120000 })
    const [id, response] = await Promise.all([
      importFromHome(page, await pinnedSource(source), page.getByTestId('home-import-pptx-input'), owned), profileResponse,
    ])
    expect(response.ok()).toBe(true)
    const profile = await response.json()
    // Requires a real configured font root missing source faces, never manufactured font HTTP responses.
    expect(profile.status, 'Use a source-font root missing required source faces').toBe('unavailable')
    const missing = profile.issues.find(issue => issue.code === 'font-unavailable' && issue.typeface && issue.part)
    expect(missing, 'A real missing face with a source-part location is required').toBeTruthy()
    await info.attach('missing-source-fonts', { body: Buffer.from(JSON.stringify(profile)), contentType: 'application/json' })
    const prior = await apiGetPresentation(request, id)
    expect(await apiGetPresentation(request, control.id)).toEqual(committed)
    await expectOriginalPptxHash(request, id, source.sha256, MIME)
    const diagnostic = page.getByRole('alert').filter({ hasText: missing.typeface }).first()
    await expect(diagnostic).toBeVisible()
    await expect(diagnostic).toContainText(missing.part)
    await selectSlide(page, 0, 'pointer')
    await expect(quick(page).getByRole('button', { name: /^(Save|Saved)$/ })).toBeEnabled()
    const current = (await savedDeck(page, request, id, 'pointer')).deck
    expect(current.pptxSemantic).toEqual(prior.pptxSemantic)
    expect(current.slides).toEqual(prior.slides)
    expect(await apiGetPresentation(request, control.id)).toEqual(committed)
    await expectOriginalPptxHash(request, id, source.sha256, MIME)
    await pinnedSource(source)
  } finally { for (const id of owned.reverse()) await apiDeletePresentation(request, id) }
})

test('negative unconfigured font roots disclose generic delivery failure without source mutation', async ({ page, request }, info) => {
  test.setTimeout(180000)
  const source = inheritanceJourney.source, owned = []
  try {
    const control = await apiCreatePresentation(request, 'Unconfigured fonts prior committed control')
    owned.push(control.id)
    const committed = await apiGetPresentation(request, control.id)
    await home(page)
    const delivery = page.waitForResponse(response =>
      /\/api\/presentations\/[^/]+\/semantic-fonts\?/.test(response.url()), { timeout: 120000 })
    const [id, response] = await Promise.all([
      importFromHome(page, await pinnedSource(source), page.getByTestId('home-import-pptx-input'), owned), delivery,
    ])
    expect(response.ok()).toBe(true)
    const profile = await response.json()
    expect(profile.status, 'Run with NAVSLIDES_PPTX_FONT_ROOTS unset or []').toBe('unavailable')
    expect(profile.issues).toContainEqual({ code: 'source-font-roots-unconfigured' })
    const prior = await apiGetPresentation(request, id)
    await expect(page.getByRole('alert').filter({ hasText: /source-font-roots-unconfigured/i }).first()).toBeVisible()
    await selectSlide(page, 0, 'pointer')
    const saved = (await savedDeck(page, request, id, 'pointer')).deck
    expect(saved.pptxSemantic).toEqual(prior.pptxSemantic)
    expect(saved.slides).toEqual(prior.slides)
    expect(await apiGetPresentation(request, control.id)).toEqual(committed)
    await expectOriginalPptxHash(request, id, source.sha256, MIME)
    await pinnedSource(source)
    await info.attach('unconfigured-source-fonts', {
      body: Buffer.from(JSON.stringify(profile)), contentType: 'application/json',
    })
  } finally { for (const id of owned.reverse()) await apiDeletePresentation(request, id) }
})
}
