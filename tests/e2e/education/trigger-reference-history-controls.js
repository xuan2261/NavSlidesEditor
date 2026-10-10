import { expect, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { selectContent, inspector, fillControl } from './release-content-fields.js'
import shared from 'revealjs-shared'

export async function deselectElements(page) {
  await page.getByTestId('canvas-area').click({ position: { x: 10, y: 10 } })
}

export async function configureVariable(page, { name, initialValue, min, max }) {
  await deselectElements(page)
  if (!(await inspector(page).isVisible()))
    await page.getByRole('button', { name: 'Properties', exact: true }).click()
  await page.getByRole('button', { name: 'Add variable', exact: true }).click()
  const rows = page.locator('[data-interaction-variable-editor] fieldset')
  const count = await rows.count()
  const prefix = `Variable ${count}`
  if (name !== undefined) {
    await page.getByLabel(`${prefix} name`, { exact: true }).fill(name)
  }
  if (initialValue !== undefined) {
    await page.getByLabel(`${prefix} initial value`, { exact: true }).fill(String(initialValue))
  }
  if (min !== undefined) {
    await page.getByLabel(`${prefix} minimum`, { exact: true }).fill(String(min))
  }
  if (max !== undefined) {
    await page.getByLabel(`${prefix} maximum`, { exact: true }).fill(String(max))
  }
}

export async function authorActionUI(page, elementId, action, options = {}) {
  const target = page.getByTestId(`slide-element-${elementId}`)
  if ((await target.getAttribute('data-selected')) !== 'true') await selectContent(page, elementId)
  const panel = inspector(page)
  if (options.initialVisibility) {
    const visSelect = panel.getByLabel('Initial runtime visibility', { exact: true })
    await visSelect.selectOption(options.initialVisibility)
  }
  if (options.fragment) {
    const toggle = panel.getByTestId('prop-fragment-toggle')
    await toggle.check()
    if (options.fragmentIndex !== undefined) {
      await panel.getByTestId('prop-fragment-index').fill(String(options.fragmentIndex))
    }
  }
  if (action?.kind) {
    const kindSelect = panel.getByRole('combobox', { name: 'Element action', exact: true })
    await kindSelect.selectOption(action.kind)
    if (action.targetElementId) {
      await panel
        .getByRole('combobox', { name: 'Target element', exact: true })
        .selectOption(action.targetElementId)
    }
    if (action.variableId) {
      await panel
        .getByRole('combobox', { name: 'Score variable', exact: true })
        .selectOption(action.variableId)
      if (action.amount !== undefined) {
        await fillControl(page, 'Score amount', action.amount)
      }
    }
    if (action.kind === 'reset-slide' && action.resetVariables !== undefined) {
      const chk = panel.getByRole('checkbox', { name: 'Reset deck variables', exact: true })
      if (action.resetVariables) await chk.check()
      else await chk.uncheck()
    }
    if (action.label) {
      await fillControl(page, 'Action label', action.label)
    }
  }
}

export async function executeCopyPaste(page, sourceElementIds) {
  if (sourceElementIds.length === 0) return
  await selectContent(page, sourceElementIds[0])
  for (let i = 1; i < sourceElementIds.length; i++) {
    const el = page.locator(`[data-testid="slide-element-${sourceElementIds[i]}"]`)
    await el.click({ modifiers: ['Shift'] })
  }
  await page.keyboard.press('ControlOrMeta+c')
  await page.keyboard.press('ControlOrMeta+v')
}

export async function duplicateActiveSlide(page, slideIndex = 0) {
  const thumbnail = page.getByRole('button', {
    name: `Select slide ${slideIndex + 1}`,
    exact: true,
  })
  await thumbnail.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Slide actions' })
  await menu.getByRole('menuitem', { name: 'Duplicate', exact: true }).click()
}

export async function duplicateActiveChildSlide(page, parentIndex = 0, childIndex = 0) {
  const childThumb = page.getByRole('button', {
    name: `Select vertical slide ${parentIndex + 1}.${childIndex + 1}`,
    exact: true,
  })
  await childThumb.click()
  await childThumb.click({ button: 'right' })
  await page
    .getByRole('menu', { name: 'Slide actions', exact: true })
    .getByRole('menuitem', { name: 'Duplicate', exact: true })
    .click()
}

export async function detachSlideLayout(page, slideIndex = 0) {
  const slideItem = page.getByRole('button', {
    name: `Select slide ${slideIndex + 1}`,
    exact: true,
  })
  await slideItem.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Slide actions' })
  const detachItem = menu.getByRole('menuitem', { name: 'Detach layout', exact: true })
  await expect(detachItem).toBeVisible()
  await detachItem.click()
}

export async function undoHistory(page) {
  await page.keyboard.press('ControlOrMeta+z')
}

export async function redoHistory(page) {
  await page.keyboard.press('ControlOrMeta+y')
}

export async function typedState(request, id) {
  const { createdAt, updatedAt, ...content } = await apiGetPresentation(request, id)
  return content
}
function canonicalSlide(slide) {
  const copy = structuredClone(slide)
  if (copy.children === undefined) copy.children = []
  expect(Array.isArray(copy.children)).toBe(true)
  copy.children = copy.children.map(canonicalSlide)
  copy.elements = copy.elements.map((element) => {
    expect(shared.normalizeElementAction(element.action).error).toBe('')
    return element.action == null ? { ...element, action: null } : element
  })
  return copy
}
export function assertElementClone(copies, originals, offset = 0) {
  expect(copies).toHaveLength(originals.length)
  const mapping = new Map(originals.map((element, index) => [element.id, copies[index].id]))
  const copiedIds = copies.map((element) => element.id)
  expect(new Set(copiedIds).size).toBe(originals.length)
  expect(copiedIds.every((id) => typeof id === 'string' && id && !mapping.has(id))).toBe(true)
  const expected = originals.map((element) => ({
    ...structuredClone(element),
    id: mapping.get(element.id),
    x: element.x + offset,
    y: element.y + offset,
    ...(element.action?.targetElementId
      ? {
          action: {
            ...element.action,
            targetElementId:
              mapping.get(element.action.targetElementId) || element.action.targetElementId,
          },
        }
      : {}),
  }))
  expect(canonicalSlide({ elements: copies })).toEqual(canonicalSlide({ elements: expected }))
}
export function assertSlideClone(copy, source) {
  const ids = (node) => [
    node.id,
    ...node.elements.map((element) => element.id),
    ...(node.children || []).flatMap(ids),
  ]
  const originalIds = new Set(ids(source)),
    copiedIds = ids(copy)
  expect(new Set(copiedIds).size).toBe(copiedIds.length)
  expect(copiedIds.every((id) => typeof id === 'string' && id && !originalIds.has(id))).toBe(true)
  assertElementClone(copy.elements, source.elements)
  expect(canonicalSlide({ ...copy, elements: [], children: [] })).toEqual(
    canonicalSlide({ ...source, id: copy.id, elements: [], children: [] })
  )
  expect(copy.children || []).toHaveLength((source.children || []).length)
  for (let index = 0; index < (source.children || []).length; index++)
    assertSlideClone(copy.children[index], source.children[index])
}
export function referenceDeck() {
  const shape = (id, x, y, patch = {}) => ({
    id,
    type: 'shape',
    x,
    y,
    width: 140,
    height: 60,
    shape: 'rect',
    fill: '#6366f1',
    action: null,
    ...patch,
  })
  return {
    layoutMasters: [
      {
        id: 'master-stem',
        name: 'Master Stem',
        placeholders: [],
        fixedElements: [
          shape('fixed-source', 50, 50, {
            action: {
              kind: 'show',
              targetElementId: 'layout-fixed:master-stem:fixed-answer',
              label: 'Show fixed answer',
            },
          }),
          shape('fixed-answer', 250, 50, { initialVisibility: 'hidden' }),
        ],
      },
    ],
    slides: [
      {
        id: 's1',
        layoutId: 'master-stem',
        elements: [shape('s1-btn', 50, 200), shape('s1-ans', 250, 200)],
        children: [
          {
            id: 'c1',
            elements: [
              shape('c1-btn', 60, 210, {
                action: { kind: 'toggle', targetElementId: 'c1-ans', label: 'Toggle child answer' },
              }),
              shape('c1-ans', 260, 210, { initialVisibility: 'hidden' }),
            ],
          },
        ],
      },
    ],
  }
}
export async function assertHistoryRoundtrip(page, request, id, before, after) {
  await page.getByTestId('canvas-area').click({ position: { x: 10, y: 10 } })
  await undoHistory(page)
  await expect.poll(() => typedState(request, id)).toEqual(before)
  await redoHistory(page)
  await expect.poll(() => typedState(request, id)).toEqual(after)
  await page.reload()
  await expect(page.getByTestId('canvas-area')).toBeVisible()
  expect(await typedState(request, id)).toEqual(after)
}

export async function navigatePresent(popup, key, slideId) {
  await popup.locator('.reveal').click({ position: { x: 5, y: 5 } })
  await popup.keyboard.press(key)
  await expect
    .poll(() => popup.evaluate(() => window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId))
    .toBe(slideId)
}

export async function authoredSave(page, request, id, operation, matches) {
  const pending = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === `/api/presentations/${id}` &&
      matches(response.request().postDataJSON())
  )
  const [response] = await Promise.all([pending, operation()])
  expect(response.ok(), await response.text()).toBe(true)
  return typedState(request, id)
}
