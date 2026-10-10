# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: text-persistence-diagnostic.tmp.spec.js >> native imported text survives type Escape reorder save and reopen with boundary evidence
- Location: tests\e2e\text-persistence-diagnostic.tmp.spec.js:10:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

@@ -1,7 +1,7 @@
  Object {
-   "inputRetained": true,
+   "inputRetained": false,
    "order": Array [
      "af4c4cf4-4972-4f05-926c-c74e3af5c68e",
      "bf80e1b6-19c8-4cc0-9a80-bf5f1ef25da3",
      "17e36fca-61fe-4ee2-9e15-665ce3d7dd7c",
      "682b8406-997b-44de-9ad7-9577b21c86f1",

Call Log:
- Timeout 30000ms exceeded while waiting on the predicate
```

# Test source

```ts
  1   | import { expect } from '@playwright/test'
  2   | import { apiGetPresentation } from '../fixtures/test-fixtures.js'
  3   | import { SAMPLES } from './navigator-performance-fixtures.js'
  4   | 
  5   | export const parentButton = (page, index) => page.getByRole('button', { name: `Select slide ${index + 1}`, exact: true })
  6   | export function witness(slide, textOnly = false) {
  7   |   const element = slide.elements.find((item) => !item.hidden && (!textOnly || item.type === 'text' && !item.locked))
  8   |   if (!element?.id) throw new Error(`Known-content fixture ${slide.id} has no ${textOnly ? 'editable text' : 'visible element'} witness`)
  9   |   return element
  10  | }
  11  | async function timed(page, config, action) {
  12  |   await page.evaluate((value) => window.__navigatorProbe.arm(value), config)
  13  |   await action()
  14  |   return page.evaluate(() => window.__navigatorProbe.finish())
  15  | }
  16  | async function select(page, slide, index) {
  17  |   await parentButton(page, index).click({ position: { x: 20, y: 45 } })
  18  |   await expect(page.getByTestId(`slide-element-${witness(slide).id}`)).toBeVisible()
  19  | }
  20  | 
  21  | export async function measureInteractions(page, fixture) {
  22  |   const slides = fixture.deck.slides
  23  |   const ids = slides.map((slide) => slide.id)
  24  |   const rows = []
  25  |   const checkpoints = [slides.length - 1, 0, Math.floor(slides.length / 2)]
  26  |   for (let sample = 0; sample < SAMPLES; sample += 1) {
  27  |     const index = checkpoints[sample % checkpoints.length]
  28  |     const button = parentButton(page, index)
  29  |     await button.scrollIntoViewIfNeeded()
  30  |     rows.push(await timed(page, { kind: 'selection', sample, slideId: ids[index], elementId: witness(slides[index]).id, label: `Select slide ${index + 1}` }, () => button.click({ position: { x: 20, y: 45 } })))
  31  |   }
  32  |   const textIndex = slides.findIndex((slide) => slide.elements.some((element) => element.type === 'text' && !element.hidden && !element.locked))
  33  |   if (textIndex < 0) throw new Error('Known-content package fixture contains no editable text')
  34  |   const textSource = witness(slides[textIndex], true)
  35  |   await select(page, slides[textIndex], textIndex)
  36  |   const textElement = page.getByTestId(`slide-element-${textSource.id}`)
  37  |   await textElement.click({ force: true })
  38  |   await textElement.dblclick({ force: true })
  39  |   const editor = page.locator('.ProseMirror')
  40  |   await expect(editor).toBeVisible()
  41  |   await editor.click({ force: true })
  42  |   await page.keyboard.press('ControlOrMeta+End')
  43  |   let marker = ' NAV13:'
  44  |   await page.keyboard.type(marker)
  45  |   for (let sample = 0; sample < SAMPLES; sample += 1) {
  46  |     const character = String.fromCharCode(97 + sample)
  47  |     marker += character
  48  |     rows.push(await timed(page, { kind: 'input', sample, slideId: slides[textIndex].id, elementId: textSource.id, marker }, () => page.keyboard.type(character)))
  49  |   }
  50  |   await expect(editor).toContainText(marker)
  51  |   await page.keyboard.press('Escape')
  52  |   const nav = page.getByRole('navigation', { name: 'Slides' })
  53  |   await nav.evaluate((node) => { node.scrollTop = Math.floor((node.scrollHeight - node.clientHeight) / 2) })
  54  |   await nav.hover({ position: { x: 20, y: 100 } })
  55  |   for (let sample = 0; sample < SAMPLES; sample += 1) {
  56  |     const direction = sample % 2 ? -1 : 1
  57  |     const before = await nav.evaluate((node) => node.scrollTop)
  58  |     rows.push(await timed(page, { kind: 'scroll', sample, direction, before }, () => page.mouse.wheel(0, direction * 400)))
  59  |   }
  60  |   const active = slides[Math.floor(slides.length / 2)]
  61  |   await select(page, active, ids.indexOf(active.id))
  62  |   for (let sample = 0; sample < SAMPLES; sample += 1) {
  63  |     const from = sample % 2 ? ids.length - 1 : 0
  64  |     const to = sample % 2 ? 0 : ids.length - 1
  65  |     const moved = ids.splice(from, 1)[0]
  66  |     const movedSlide = slides.find((slide) => slide.id === moved)
  67  |     ids.splice(to, 0, moved)
  68  |     const source = parentButton(page, from)
  69  |     const target = parentButton(page, to)
  70  |     await source.scrollIntoViewIfNeeded()
  71  |     const sourceBox = await source.boundingBox()
  72  |     if (!sourceBox) throw new Error('Native drag source is not rendered')
  73  |     const beforeScroll = await nav.evaluate((node) => node.scrollTop)
  74  |     // Start a genuine native HTML5 drag, then cross the scroll viewport while held.
  75  |     await page.mouse.move(sourceBox.x + 20, sourceBox.y + 45)
  76  |     await page.mouse.down()
  77  |     try {
  78  |       await page.mouse.move(sourceBox.x + 40, sourceBox.y + 55, { steps: 5 })
  79  |       await target.scrollIntoViewIfNeeded()
  80  |       const targetBox = await target.boundingBox()
  81  |       if (!targetBox) throw new Error('Offscreen drop target failed to scroll into view')
  82  |       await page.mouse.move(targetBox.x + 20, targetBox.y + 45, { steps: 5 })
  83  |       await page.mouse.move(targetBox.x + 22, targetBox.y + 46)
  84  |       rows.push(await timed(page, { kind: 'drop', sample, movedId: moved, order: [...ids], activeId: moved, elementId: witness(movedSlide).id, beforeScroll, afterScroll: await nav.evaluate((node) => node.scrollTop), offscreenStrategy: 'native held drag + target scrollIntoView (not autoscroll qualification)' }, () => page.mouse.up()))
  85  |     } finally { await page.mouse.up() }
  86  |     await expect(parentButton(page, to)).toHaveAttribute('aria-current', 'true')
  87  |     await expect(parentButton(page, to)).toHaveAttribute('aria-pressed', 'true')
  88  |   }
  89  |   let saved
  90  |   await expect.poll(async () => {
  91  |     saved = await apiGetPresentation(page.request, fixture.id)
  92  |     const text = saved.slides.find((slide) => slide.id === slides[textIndex].id)?.elements.find((element) => element.id === textSource.id)?.content
  93  |     return { order: saved.slides.map((slide) => slide.id), inputRetained: text?.includes(marker) === true }
> 94  |   }, { timeout: 30000 }).toEqual({ order: ids, inputRetained: true })
      |                          ^ Error: expect(received).toEqual(expected) // deep equality
  95  |   await expect(page.getByRole('button', { name: 'Saving...', exact: true })).not.toBeVisible({ timeout: 5000 })
  96  |   await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeVisible({ timeout: 10000 })
  97  |   await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeEnabled()
  98  |   return { rows, persistedOrder: saved.slides.map((slide) => slide.id), persistedTextId: textSource.id, marker, generation: saved.aggregateGeneration ?? null }
  99  | }
  100 | 
  101 | export async function behaviorSmoke(page, fixture, request, testInfo) {
  102 |   const slides = fixture.deck.slides
  103 |   const last = slides.length - 1
  104 |   await select(page, slides[0], 0)
  105 |   await parentButton(page, 0).focus()
  106 |   await parentButton(page, 0).press('End')
  107 |   await expect(parentButton(page, last)).toBeFocused()
  108 |   await expect(parentButton(page, 0)).toHaveAttribute('aria-current', 'true')
  109 |   await parentButton(page, last).press('Enter')
  110 |   await expect(page.getByTestId(`slide-element-${witness(slides[last]).id}`)).toBeVisible()
  111 |   await parentButton(page, last).press('Shift+F10')
  112 |   await expect(page.getByRole('menu', { name: 'Slide actions' })).toBeVisible()
  113 |   await page.keyboard.press('Escape')
  114 |   await expect(parentButton(page, last)).toBeFocused()
  115 |   await parentButton(page, last).press('Home')
  116 |   await expect(parentButton(page, 0)).toBeFocused()
  117 |   await parentButton(page, 0).press('ArrowDown')
  118 |   await expect(parentButton(page, 1)).toBeFocused()
  119 |   await parentButton(page, 1).press('Space')
  120 |   await expect(parentButton(page, 1)).toHaveAttribute('aria-current', 'true')
  121 |   for (const index of [0, last]) {
  122 |     await select(page, slides[index], index)
  123 |     await testInfo.attach(`${fixture.name}-${index === 0 ? 'first' : 'last'}`, { body: await page.screenshot(), contentType: 'image/png' })
  124 |   }
  125 |   const childIndex = slides.findIndex((slide) => slide.children?.length)
  126 |   if (childIndex >= 0) {
  127 |     const child = slides[childIndex].children[0]
  128 |     const childButton = page.getByRole('button', { name: `Select vertical slide ${childIndex + 1}.1`, exact: true })
  129 |     await childButton.scrollIntoViewIfNeeded()
  130 |     await childButton.focus()
  131 |     await childButton.press('Enter')
  132 |     await expect(childButton).toHaveAttribute('aria-current', 'true')
  133 |     await expect(page.getByTestId(`slide-element-${witness(child).id}`)).toBeVisible()
  134 |     if (fixture.name !== 'package') {
  135 |       await expect(childButton).toContainText('Navigator measurement')
  136 |       await expect(childButton.locator('[inert]').first()).toHaveCSS('background-color', 'rgb(20, 36, 56)')
  137 |     }
  138 |     await testInfo.attach(`${fixture.name}-child`, { body: await page.screenshot(), contentType: 'image/png' })
  139 |   }
  140 |   for (const modifier of ['Control', 'Meta']) {
  141 |     await select(page, slides[0], 0)
  142 |     await parentButton(page, last).click({ modifiers: [modifier], position: { x: 20, y: 45 } })
  143 |     await expect(parentButton(page, 0)).toHaveAttribute('aria-pressed', 'true')
  144 |     await expect(parentButton(page, last)).toHaveAttribute('aria-pressed', 'true')
  145 |   }
  146 |   await select(page, slides[0], 0)
  147 |   await parentButton(page, 2).click({ modifiers: ['Shift'], position: { x: 20, y: 45 } })
  148 |   for (const index of [0, 1, 2]) await expect(parentButton(page, index)).toHaveAttribute('aria-pressed', 'true')
  149 |   await select(page, slides[0], 0)
  150 |   await parentButton(page, last).click({ modifiers: ['ControlOrMeta'], position: { x: 20, y: 45 } })
  151 |   const remaining = slides.filter((_, index) => index !== 0 && index !== last).map((slide) => slide.id)
  152 |   await page.getByTitle('Delete all selected').click()
  153 |   await expect(page.getByTestId('slide-panel-item')).toHaveCount(remaining.length)
  154 |   await expect.poll(async () => (await apiGetPresentation(request, fixture.id)).slides.map((slide) => slide.id), { timeout: 30000 }).toEqual(remaining)
  155 |   await expect(page.getByRole('button', { name: 'Saving...', exact: true })).not.toBeVisible({ timeout: 5000 })
  156 |   await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeVisible({ timeout: 10000 })
  157 |   await expect(page.getByRole('button', { name: /^(Save|Saved)$/ })).toBeEnabled()
  158 |   return { keyboard: 'passed', multiselect: 'passed', bulkDeletedIds: [slides[0].id, slides[last].id], remainingIds: remaining, child: childIndex >= 0 ? 'passed' : 'not-applicable: fixture has zero children' }
  159 | }
  160 | 
```