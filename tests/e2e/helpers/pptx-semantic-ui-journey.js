import { expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'

export async function activate(locator, interaction) {
  await expect(locator).toBeVisible()
  await expect(locator).toBeEnabled()
  if (interaction === 'keyboard') {
    await locator.focus()
    await locator.press('Enter')
  } else await locator.click()
}

export async function fillField(locator, value, interaction) {
  await expect(locator).toBeVisible()
  await expect(locator).toBeEditable()
  if (interaction === 'pointer') await locator.click()
  else await locator.focus()
  // fill emits one input/change transaction rather than one history entry per character.
  await locator.fill(String(value))
  await locator.press('Tab')
}

export async function selectOption(locator, value, interaction) {
  await expect(locator).toBeVisible()
  if (interaction === 'pointer') await locator.selectOption(value)
  else {
    const choices = await locator.locator('option').evaluateAll(nodes => nodes.map(node => node.value))
    const index = choices.indexOf(String(value))
    expect(index, `Missing option ${value}`).toBeGreaterThanOrEqual(0)
    await locator.focus()
    const current = await locator.evaluate(node => node.selectedIndex)
    const delta = index - current
    if (delta !== 0) {
      const key = delta < 0 ? 'ArrowUp' : 'ArrowDown'
      for (let step = 0; step < Math.abs(delta); step++) await locator.press(key)
      await locator.press('Enter')
    }
  }
  await expect(locator).toHaveValue(String(value))
}

export async function home(page) {
  await page.goto('/')
  await expect(page.getByTestId('home-import-pptx-input')).toBeAttached()
}

export async function importFromHome(page, file, input, owned, interaction = 'pointer') {
  console.log(`[UI] Starting importFromHome for ${file}...`)
  const outcome = page.waitForFunction(() => {
    const id = globalThis.location.pathname.match(/^\/editor\/([^/?#]+)$/)?.[1]
    if (id) return { kind: 'opened', id }
    const alert = [...globalThis.document.querySelectorAll('[role="alert"]')].find(
      element => element.getClientRects().length && element.textContent.trim())
    return alert ? { kind: 'error', message: alert.textContent.trim() } : false
  }, undefined, { timeout: 180000 })
  console.log(`[UI] Setting input files on input element...`)
  const [handle] = await Promise.all([outcome, input.setInputFiles(file)])
  const result = await handle.jsonValue()
  console.log(`[UI] Import outcome result:`, result)
  expect(result, `Dashboard import: ${JSON.stringify(result)}`).toMatchObject({ kind: 'opened' })
  owned.push(result.id)
  console.log(`[UI] Waiting for canvas area to be visible...`)
  const notice = page.getByRole('dialog', { name: 'PPTX import completed with warnings', exact: true })
  if (await notice.isVisible().catch(() => false)) {
    await activate(notice.getByRole('button', { name: 'OK', exact: true }), interaction)
    await expect(notice).not.toBeVisible()
  }
  await expect(page.getByTestId('canvas-area')).toBeVisible({ timeout: 90000 })
  if (await notice.isVisible().catch(() => false)) {
    await activate(notice.getByRole('button', { name: 'OK', exact: true }), interaction)
    await expect(notice).not.toBeVisible()
  }
  console.log(`[UI] importFromHome complete, presentation id: ${result.id}`)
  return result.id
}

export async function pinnedSource(source) {
  const file = path.resolve(source.path)
  const bytes = await readFile(file)
  expect(createHash('sha256').update(bytes).digest('hex'), source.path).toBe(source.sha256)
  return file
}

export async function selectSlide(page, index, interaction) {
  const trigger = page.getByRole('button', { name: 'Open slide navigator', exact: true })
  if (await trigger.isVisible()) await activate(trigger, interaction)
  const item = page.getByTestId('slide-panel-item').nth(index)
  const button = item.getByRole('button', { name: `Select slide ${index + 1}` })
  const target = (await button.count()) ? button : item
  await activate(target, interaction)
  await expect(item).toHaveClass(/border-accent/)
  await closeOverlay(page, interaction)
}

export async function closeOverlay(page, interaction = 'pointer') {
  const timeline = page.getByRole('button', { name: 'Close timeline', exact: true })
  if (await timeline.isVisible()) await activate(timeline, interaction)
  const overlay = page.getByRole('button', { name: 'Close workspace overlay', exact: true })
  if (await overlay.isVisible()) {
    if (interaction === 'pointer') {
      await overlay.click({ force: true })
    } else {
      await overlay.focus()
      await page.keyboard.press('Escape')
      if (await overlay.isVisible()) {
        await overlay.press('Enter')
      }
    }
    await expect(overlay).not.toBeVisible()
  }
}

export async function inspector(page, interaction) {
  const panel = page.getByRole('complementary', { name: 'Properties panel', exact: true })
  if (await panel.isVisible()) return panel
  const trigger = page.getByRole('button', { name: 'Open inspector', exact: true })
  if (await trigger.isVisible()) await activate(trigger, interaction)
  await expect(panel).toBeVisible()
  return panel
}

export async function selectElement(page, target, interaction) {
  const rendered = page.getByTestId(`slide-element-${target.element.id}`)
  if (interaction === 'pointer' && target.pointerPosition) {
    await rendered.click({ position: target.pointerPosition })
  } else if (await rendered.getAttribute('data-selected') !== 'true') {
    // Enter on an already-selected text occurrence starts editing instead of selecting.
    await activate(rendered, interaction)
  }
  await expect(rendered).toHaveAttribute('data-selected', 'true')
  return rendered
}

export async function explicitSave(page, id, interaction = 'pointer') {
  await closeOverlay(page, interaction)
  const toolbar = page.getByRole('toolbar', { name: 'Quick actions', exact: true })
  const save = toolbar.getByRole('button', { name: /^(Save|Saved)$/ })
  // Drain the prior autosave before subscribing; never let an already-running PUT
  // masquerade as the response to the visible explicit Save action.
  await expect(save).toBeEnabled({ timeout: 60000 })
  // Capture the transition in-page: protocol/body transfer may outlast the
  // transient Saved label. Require a new Saving -> Saved cycle, not stale UI.
  const confirmation = await save.evaluateHandle(button => {
    const state = { saving: false, saved: false }
    const observer = new MutationObserver(records => {
      // React may publish Saving and Saved in one observer batch. Attribute old
      // values retain that transition even when the final DOM already says Saved.
      if (records.some(record => record.attributeName === 'aria-label' && record.oldValue === 'Saving...') ||
          (button.disabled && button.getAttribute('aria-label') === 'Saving...')) state.saving = true
      if (state.saving && !button.disabled && button.getAttribute('aria-label') === 'Saved') state.saved = true
    })
    observer.observe(button, { attributes: true, attributeOldValue: true })
    return { state, disconnect: () => observer.disconnect() }
  })
  const requests = new Set()
  const observe = request => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === `/api/presentations/${id}`)
      requests.add(request)
  }
  page.on('request', observe)
  try {
    const [response] = await Promise.all([
      page.waitForResponse(candidate => requests.has(candidate.request()), { timeout: 60000 }),
      activate(save, interaction),
    ])
    const responseBody = await response.text()
    expect(response.ok(), `Explicit Save HTTP ${response.status()}: ${responseBody}`).toBe(true)
    await page.waitForFunction(value => value.state.saved, confirmation, { timeout: 30000 })
    await expect(save).toBeEnabled({ timeout: 30000 })
    return { status: response.status(), method: response.request().method(), responseBody,
      confirmation: await confirmation.evaluate(value => value.state) }
  } finally {
    page.off('request', observe)
    await confirmation.evaluate(value => value.disconnect())
    await confirmation.dispose()
  }
}

export async function savedDeck(page, request, id, interaction) {
  const receipt = await explicitSave(page, id, interaction)
  return { deck: await apiGetPresentation(request, id), receipt }
}

export async function history(page, direction, interaction) {
  const control = page.getByRole('toolbar', { name: 'Quick actions', exact: true })
    .getByRole('button', { name: direction, exact: true })
  // Never fire a shortcut before the editor has published its history transaction.
  await expect(control).toBeEnabled({ timeout: 30000 })
  if (interaction === 'pointer') await activate(control, interaction)
  else {
    await page.getByTestId('canvas-area').focus()
    await page.keyboard.press(direction === 'Undo' ? 'ControlOrMeta+z' : 'ControlOrMeta+y')
  }
}
