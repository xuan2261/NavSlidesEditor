import { expect } from '@playwright/test'
import touchDriver from '../helpers/cdp-multi-touch-driver.js'

const { createCdpMultiTouchDriver } = touchDriver
const orderIds = (root) =>
  root
    .locator('[data-ns-order-item]')
    .evaluateAll((rows) => rows.map((row) => row.dataset.nsOrderItem))

async function center(control) {
  const box = await control.boundingBox()
  expect(box, 'A genuine input target must have rendered bounds').not.toBeNull()
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  expect(
    await control.evaluate(
      (node, point) => node.contains(node.ownerDocument.elementFromPoint(point.x, point.y)),
      point
    ),
    'The genuine gesture point must hit its intended control after all scrolling'
  ).toBe(true)
  return point
}

async function drag(page, source, target, touch) {
  await source.scrollIntoViewIfNeeded()
  await target.scrollIntoViewIfNeeded()
  const start = await center(source)
  if (touch) {
    await touch.start([start])
    const end = await center(target)
    for (let step = 1; step <= 12; step++)
      await touch.move([
        {
          x: start.x + ((end.x - start.x) * step) / 12,
          y: start.y + ((end.y - start.y) * step) / 12,
        },
      ])
    await touch.end()
  } else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    const end = await center(target)
    await page.mouse.move(end.x, end.y, { steps: 12 })
    await page.mouse.up()
  }
}

async function activate(control, mode) {
  if (mode === 'keyboard') await control.press('Enter')
  else await control.click()
}

async function place(root, pair, mode, touch) {
  const source = root.locator(`[data-ns-source="${pair.source}"]`),
    target = root.locator(`[data-ns-target="${pair.target}"]`)
  if (mode === 'pointer' || mode === 'touch') await drag(root.page(), source, target, touch)
  else if (mode === 'keyboard') {
    await source.press('Enter')
    await target.press('Space')
  } else {
    await source.click()
    await target.click()
  }
  await expect(source.locator('..').locator('[data-ns-assigned-label]')).toContainText(pair.label)
}

export async function completeMapping(root, type, config, mode) {
  const page = root.page(),
    touch = mode === 'touch' ? await createCdpMultiTouchDriver(page) : null
  await page.evaluate(() => {
    window.__mappingInputs = []
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ])
      document.addEventListener(
        type,
        (event) => {
          const control = event.target.closest?.('[data-ns-source], [data-ns-target]')
          if (!control) return
          const hit = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest('[data-ns-source], [data-ns-target]')
          queueMicrotask(() =>
            window.__mappingInputs.push({
              type,
              pointerType: event.pointerType,
              trusted: event.isTrusted,
              pointerId: event.pointerId,
              sourceId: control.dataset.nsSource || null,
              targetId: control.dataset.nsTarget || null,
              x: event.clientX,
              y: event.clientY,
              captured: control.hasPointerCapture(event.pointerId),
              selected: control.getAttribute('aria-pressed'),
              hitSource: hit?.dataset.nsSource || null,
              hitTarget: hit?.dataset.nsTarget || null,
            })
          )
        },
        true
      )
  })
  const indices = await page.evaluate(() => window.Reveal.getIndices())
  try {
    expect(indices).toMatchObject({ h: 0, v: 0 })
    let initial, assigned, incorrect
    if (type === 'ordering') {
      const question = config.questions[0],
        expected = question.answerKey.itemIds
      initial = await orderIds(root)
      expect(initial).toEqual(question.options.map((item) => item.id))
      expect(initial).not.toEqual(expected)
      await activate(root.getByRole('button', { name: 'Submit answer', exact: true }), mode)
      await expect(root.locator('[data-ns-game-ui] > [role="status"]')).toContainText(
        question.feedback.incorrect
      )
      await expect(root).toContainText('Score: 0')
      await expect(root).toContainText('Attempts 1/2')
      await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeEnabled()
      incorrect = await root.innerText()
      for (const id of expected.slice().reverse()) {
        const row = root.locator(`[data-ns-order-item="${id}"]`)
        if (mode === 'pointer' || mode === 'touch') {
          const current = await orderIds(root)
          if (current[0] !== id)
            await drag(
              page,
              row.locator('[data-ns-source]'),
              root.locator('[data-ns-order-item]').first(),
              touch
            )
        } else {
          const item = question.options.find((item) => item.id === id)
          const up = row.getByRole('button', { name: `Move ${item.text} up`, exact: true })
          while ((await up.getAttribute('aria-disabled')) === 'false') await activate(up, mode)
        }
      }
      await expect.poll(() => orderIds(root)).toEqual(expected)
      assigned = await orderIds(root)
      await activate(root.getByRole('button', { name: 'Submit answer', exact: true }), mode)
      await expect(root.locator('[data-ns-game-ui] > [role="status"]')).toContainText(
        question.feedback.correct
      )
      await expect(root).toContainText(`Score: ${question.points}`)
      await activate(root.getByRole('button', { name: 'Finish quiz', exact: true }), mode)
    } else {
      if (type === 'matching') {
        await root
          .getByRole('textbox', { name: 'Participant name', exact: true })
          .fill('Modality learner')
        await activate(root.getByRole('button', { name: 'Add participant', exact: true }), mode)
        await activate(root.getByRole('button', { name: 'Start', exact: true }), mode)
      }
      initial = await root.locator('[data-ns-assigned-label]').allTextContents()
      expect(initial).toEqual(config[type === 'matching' ? 'pairs' : 'items'].map(() => ''))
      const pairs =
        type === 'matching'
          ? config.pairs.map((pair) => ({
              source: pair.promptId,
              target: pair.targetId,
              label: pair.target,
            }))
          : config.answerKey.assignments.map((pair) => ({
              source: pair.itemId,
              target: pair.bucketId,
              label: config.buckets.find((row) => row.id === pair.bucketId).label,
            }))
      const submit = root.getByRole('button', {
        name: type === 'matching' ? 'Submit matches' : 'Check sorting',
        exact: true,
      })
      for (const [index, pair] of pairs.entries()) {
        const wrong = pairs[(index + 1) % pairs.length]
        await place(root, { ...pair, target: wrong.target, label: wrong.label }, mode, touch)
      }
      await activate(submit, mode)
      if (type === 'matching')
        await expect(root.locator('.ns-classroom-controls [role="status"]')).toContainText(
          `0 / ${config.pairs.length} pairs correct`
        )
      else {
        await expect(root).toContainText('Not yet. Change your assignments and try again.')
        await expect(root).toContainText(`Score: 0. Attempts: 1/${config.attemptLimit}.`)
      }
      incorrect = await root.innerText()
      for (const clear of await root.locator('[data-ns-command="assignment-clear"]').all())
        await activate(clear, mode)
      await expect(root.locator('[data-ns-assigned-label]')).toHaveText(initial)
      for (const pair of pairs) await place(root, pair, mode, touch)
      assigned = await root.locator('[data-ns-assigned-label]').allTextContents()
      await activate(
        root.getByRole('button', {
          name: type === 'matching' ? 'Submit matches' : 'Check sorting',
          exact: true,
        }),
        mode
      )
      if (type === 'matching') {
        await expect(root.locator('.ns-classroom-controls [role="status"]')).toContainText(
          `${config.pairs.length} / ${config.pairs.length} pairs correct`
        )
        await activate(root.getByRole('button', { name: 'Reveal results', exact: true }), mode)
        await expect(root.locator('[data-ns-results]')).toContainText(
          `Modality learner: ${config.pairs.length} / ${config.pairs.length} pairs correct`
        )
      } else {
        await expect(root).toContainText('Correct! All items are sorted.')
        await expect(root).toContainText(
          `Score: ${config.points}. Attempts: 2/${config.attemptLimit}.`
        )
      }
    }
    const evaluated = await root.innerText()
    const inputEvents = await page.evaluate(() => window.__mappingInputs)
    if (mode === 'pointer' || mode === 'touch') {
      expect(inputEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'pointerdown',
            pointerType: mode === 'touch' ? 'touch' : 'mouse',
            trusted: true,
          }),
        ])
      )
      for (const down of inputEvents.filter((event) => event.type === 'pointerdown'))
        expect(down.hitSource).toBe(down.sourceId)
    }
    await activate(
      root.getByRole('button', {
        name: type === 'ordering' ? 'Reset quiz' : type === 'sorting' ? 'Reset sorting' : 'Reset',
        exact: true,
      }),
      mode
    )
    if (type === 'ordering') {
      await expect(root).toContainText('Score: 0')
      await expect.poll(() => orderIds(root)).toEqual(initial)
    } else {
      await expect
        .poll(() => root.locator('[data-ns-assigned-label]').allTextContents())
        .toEqual(initial)
      if (type === 'matching') {
        await expect(root.locator('[data-ns-results]')).not.toContainText('Modality learner')
        await expect(
          root.getByRole('combobox', { name: 'Current participant', exact: true })
        ).toBeDisabled()
      } else await expect(root).toContainText(`Score: 0. Attempts: 0/${config.attemptLimit}.`)
    }
    const afterIndices = await page.evaluate(() => window.Reveal.getIndices())
    expect(afterIndices).toEqual(indices)
    return {
      mode,
      initial,
      incorrect,
      assigned,
      evaluated,
      reset: await root.innerText(),
      inputEvents,
      indices,
      afterIndices,
    }
  } finally {
    await touch?.close()
  }
}
