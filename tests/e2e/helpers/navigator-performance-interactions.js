import { expect } from '@playwright/test'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import { SAMPLES } from './navigator-performance-fixtures.js'

export const parentButton = (page, index) => page.getByRole('button', { name: `Select slide ${index + 1}`, exact: true })
export function witness(slide, textOnly = false) {
  const element = slide.elements.find((item) => !item.hidden && (!textOnly || item.type === 'text' && !item.locked))
  if (!element?.id) throw new Error(`Known-content fixture ${slide.id} has no ${textOnly ? 'editable text' : 'visible element'} witness`)
  return element
}
async function timed(page, config, action) {
  await page.evaluate((value) => window.__navigatorProbe.arm(value), config)
  await action()
  return page.evaluate(() => window.__navigatorProbe.finish())
}
async function select(page, slide, index) {
  await parentButton(page, index).click({ position: { x: 20, y: 45 } })
  await expect(page.getByTestId(`slide-element-${witness(slide).id}`)).toBeVisible()
}

export async function measureInteractions(page, fixture) {
  const slides = fixture.deck.slides
  const ids = slides.map((slide) => slide.id)
  const rows = []
  const checkpoints = [slides.length - 1, 0, Math.floor(slides.length / 2)]
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const index = checkpoints[sample % checkpoints.length]
    const button = parentButton(page, index)
    await button.scrollIntoViewIfNeeded()
    rows.push(await timed(page, { kind: 'selection', sample, slideId: ids[index], elementId: witness(slides[index]).id, label: `Select slide ${index + 1}` }, () => button.click({ position: { x: 20, y: 45 } })))
  }
  const textIndex = slides.findIndex((slide) => slide.elements.some((element) => element.type === 'text' && !element.hidden && !element.locked))
  if (textIndex < 0) throw new Error('Known-content package fixture contains no editable text')
  await select(page, slides[textIndex], textIndex)
  // Choose one exposed point before acting; never force clicks through another element.
  const target = await page.evaluate((elements) => {
    for (const element of elements) {
      const node = document.querySelector(`[data-testid="slide-element-${CSS.escape(element.id)}"]`)
      if (!node) continue
      const box = node.getBoundingClientRect()
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75]]) {
        const x = box.left + box.width * fx, y = box.top + box.height * fy
        if (x > 0 && y > 0 && x < innerWidth && y < innerHeight && node.contains(document.elementFromPoint(x, y))) {
          return { id: element.id, hitpoint: { x, y } }
        }
      }
    }
    throw new Error('Known-content slide has no exposed editable text hitpoint')
  }, slides[textIndex].elements.filter((element) => element.type === 'text' && !element.hidden && !element.locked))
  const textSource = slides[textIndex].elements.find((element) => element.id === target.id)
  const textElement = page.getByTestId(`slide-element-${textSource.id}`)
  await page.mouse.dblclick(target.hitpoint.x, target.hitpoint.y)
  const editor = textElement.locator('.ProseMirror')
  await expect(editor).toBeVisible()
  await expect(parentButton(page, textIndex)).toHaveAttribute('aria-current', 'true')
  await expect(editor).toBeFocused()
  await page.keyboard.press('ControlOrMeta+End')
  let marker = ' NAV13:'
  await page.keyboard.type(marker)
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const character = String.fromCharCode(97 + sample)
    marker += character
    rows.push(await timed(page, { kind: 'input', sample, slideId: slides[textIndex].id, elementId: textSource.id, marker }, () => page.keyboard.type(character)))
  }
  await expect(editor).toContainText(marker)
  await page.keyboard.press('Escape')
  const nav = page.getByRole('navigation', { name: 'Slides' })
  await nav.evaluate((node) => { node.scrollTop = Math.floor((node.scrollHeight - node.clientHeight) / 2) })
  await nav.hover({ position: { x: 20, y: 100 } })
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const direction = sample % 2 ? -1 : 1
    const before = await nav.evaluate((node) => node.scrollTop)
    rows.push(await timed(page, { kind: 'scroll', sample, direction, before }, () => page.mouse.wheel(0, direction * 400)))
  }
  const active = slides[Math.floor(slides.length / 2)]
  await select(page, active, ids.indexOf(active.id))
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const from = sample % 2 ? ids.length - 1 : 0
    const to = sample % 2 ? 0 : ids.length - 1
    const moved = ids.splice(from, 1)[0]
    const movedSlide = slides.find((slide) => slide.id === moved)
    ids.splice(to, 0, moved)
    const source = parentButton(page, from)
    const target = parentButton(page, to)
    await source.scrollIntoViewIfNeeded()
    const sourceBox = await source.boundingBox()
    if (!sourceBox) throw new Error('Native drag source is not rendered')
    const beforeScroll = await nav.evaluate((node) => node.scrollTop)
    // Start a genuine native HTML5 drag, then cross the scroll viewport while held.
    await page.mouse.move(sourceBox.x + 20, sourceBox.y + 45)
    await page.mouse.down()
    try {
      await page.mouse.move(sourceBox.x + 40, sourceBox.y + 55, { steps: 5 })
      await target.scrollIntoViewIfNeeded()
      const targetBox = await target.boundingBox()
      if (!targetBox) throw new Error('Offscreen drop target failed to scroll into view')
      await page.mouse.move(targetBox.x + 20, targetBox.y + 45, { steps: 5 })
      await page.mouse.move(targetBox.x + 22, targetBox.y + 46)
      rows.push(await timed(page, { kind: 'drop', sample, movedId: moved, order: [...ids], activeId: moved, elementId: witness(movedSlide).id, beforeScroll, afterScroll: await nav.evaluate((node) => node.scrollTop), offscreenStrategy: 'native held drag + target scrollIntoView (not autoscroll qualification)' }, () => page.mouse.up()))
    } finally { await page.mouse.up() }
    await expect(parentButton(page, to)).toHaveAttribute('aria-current', 'true')
    await expect(parentButton(page, to)).toHaveAttribute('aria-pressed', 'true')
  }
  let saved
  await expect.poll(async () => {
    saved = await apiGetPresentation(page.request, fixture.id)
    const text = saved.slides.find((slide) => slide.id === slides[textIndex].id)?.elements.find((element) => element.id === textSource.id)?.content
    return { order: saved.slides.map((slide) => slide.id), inputRetained: text?.includes(marker) === true }
  }, { timeout: 30000 }).toEqual({ order: ids, inputRetained: true })
  await expect(page.getByRole('button', { name: 'Saving...', exact: true })).not.toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeEnabled()
  return { rows, persistedOrder: saved.slides.map((slide) => slide.id), persistedTextId: textSource.id, inputTarget: { slideId: slides[textIndex].id, element: textSource, hitpoint: target.hitpoint }, marker, generation: saved.aggregateGeneration ?? null }
}

export async function behaviorSmoke(page, fixture, request, testInfo) {
  const slides = fixture.deck.slides
  const last = slides.length - 1
  await select(page, slides[0], 0)
  await parentButton(page, 0).focus()
  await parentButton(page, 0).press('End')
  await expect(parentButton(page, last)).toBeFocused()
  await expect(parentButton(page, 0)).toHaveAttribute('aria-current', 'true')
  await parentButton(page, last).press('Enter')
  await expect(page.getByTestId(`slide-element-${witness(slides[last]).id}`)).toBeVisible()
  await parentButton(page, last).press('Shift+F10')
  await expect(page.getByRole('menu', { name: 'Slide actions' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(parentButton(page, last)).toBeFocused()
  await parentButton(page, last).press('Home')
  await expect(parentButton(page, 0)).toBeFocused()
  await parentButton(page, 0).press('ArrowDown')
  await expect(parentButton(page, 1)).toBeFocused()
  await parentButton(page, 1).press('Space')
  await expect(parentButton(page, 1)).toHaveAttribute('aria-current', 'true')
  for (const index of [0, last]) {
    await select(page, slides[index], index)
    await testInfo.attach(`${fixture.name}-${index === 0 ? 'first' : 'last'}`, { body: await page.screenshot(), contentType: 'image/png' })
  }
  const childIndex = slides.findIndex((slide) => slide.children?.length)
  if (childIndex >= 0) {
    const child = slides[childIndex].children[0]
    const childButton = page.getByRole('button', { name: `Select vertical slide ${childIndex + 1}.1`, exact: true })
    await childButton.scrollIntoViewIfNeeded()
    await childButton.focus()
    await childButton.press('Enter')
    await expect(childButton).toHaveAttribute('aria-current', 'true')
    await expect(page.getByTestId(`slide-element-${witness(child).id}`)).toBeVisible()
    if (fixture.name !== 'package') {
      await expect(childButton).toContainText('Navigator measurement')
      await expect(childButton.locator('[inert]').first()).toHaveCSS('background-color', 'rgb(20, 36, 56)')
    }
    await testInfo.attach(`${fixture.name}-child`, { body: await page.screenshot(), contentType: 'image/png' })
  }
  for (const modifier of ['Control', 'Meta']) {
    await select(page, slides[0], 0)
    await parentButton(page, last).click({ modifiers: [modifier], position: { x: 20, y: 45 } })
    await expect(parentButton(page, 0)).toHaveAttribute('aria-pressed', 'true')
    await expect(parentButton(page, last)).toHaveAttribute('aria-pressed', 'true')
  }
  await select(page, slides[0], 0)
  await parentButton(page, 2).click({ modifiers: ['Shift'], position: { x: 20, y: 45 } })
  for (const index of [0, 1, 2]) await expect(parentButton(page, index)).toHaveAttribute('aria-pressed', 'true')
  await select(page, slides[0], 0)
  await parentButton(page, last).click({ modifiers: ['ControlOrMeta'], position: { x: 20, y: 45 } })
  const remaining = slides.filter((_, index) => index !== 0 && index !== last).map((slide) => slide.id)
  await page.getByTitle('Delete all selected').click()
  await expect(page.getByTestId('slide-panel-item')).toHaveCount(remaining.length)
  await expect.poll(async () => (await apiGetPresentation(request, fixture.id)).slides.map((slide) => slide.id), { timeout: 30000 }).toEqual(remaining)
  await expect(page.getByRole('button', { name: 'Saving...', exact: true })).not.toBeVisible({ timeout: 30000 })
  await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeEnabled()
  return { keyboard: 'passed', multiselect: 'passed', bulkDeletedIds: [slides[0].id, slides[last].id], remainingIds: remaining, child: childIndex >= 0 ? 'passed' : 'not-applicable: fixture has zero children' }
}
