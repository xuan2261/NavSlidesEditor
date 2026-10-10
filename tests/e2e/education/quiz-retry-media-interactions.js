import { expect } from '@playwright/test'

const submit = (root) => root.getByRole('button', { name: 'Submit answer', exact: true })
const status = (root) => root.locator('[data-ns-game-ui] > [role="status"]')
const progress = (attempts) => `Question 1 of 1 • Attempts ${attempts}/2`

async function assertState(root, attempts, score) {
  await expect(root.getByText(progress(attempts), { exact: true })).toBeVisible()
  await expect(root.getByText(`Score: ${score}`, { exact: true })).toBeVisible()
}
async function snapshot(root) {
  return { status: await status(root).innerText(), text: await root.innerText() }
}
async function reset(root, question) {
  await root.getByRole('button', { name: 'Reset quiz', exact: true }).click()
  await assertState(root, 0, 0)
  await expect(status(root)).toHaveText('')
  await expect(root.getByRole('heading', { name: question.prompt, exact: true })).toBeVisible()
  await expect(submit(root)).toBeEnabled()
  await expect(root.getByRole('button', { name: 'Finish quiz', exact: true })).toBeHidden()
}

async function hotspotPoint(root, position) {
  const image = root.locator('fieldset img')
  await image.scrollIntoViewIfNeeded()
  const geometry = await image.evaluate((image) => {
    const box = image.getBoundingClientRect(),
      style = getComputedStyle(image)
    const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight)
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale
    return {
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      style: {
        width: style.width,
        height: style.height,
        maxWidth: style.maxWidth,
        maxHeight: style.maxHeight,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
      },
      content: {
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2,
        width,
        height,
      },
    }
  })
  const { box, content } = geometry
  if (position === 'letterbox') expect(content.x - box.x).toBeGreaterThan(4)
  const point =
    position === 'letterbox'
      ? { x: (box.x + content.x) / 2, y: content.y + content.height / 2 }
      : { x: content.x + content.width * position.x, y: content.y + content.height * position.y }
  if (position === 'letterbox') {
    expect(point.x).toBeGreaterThan(box.x + 2)
    expect(point.x).toBeLessThan(content.x - 2)
    expect(point.y).toBeGreaterThan(box.y)
    expect(point.y).toBeLessThan(box.y + box.height)
  }
  expect(
    await image.evaluate(
      (image, point) => image.ownerDocument.elementFromPoint(point.x, point.y) === image,
      point
    )
  ).toBe(true)
  await image.evaluate((image) => {
    image.addEventListener(
      'pointerdown',
      (event) => {
        image.__retryPointer = {
          trusted: event.isTrusted,
          type: event.pointerType,
          x: event.clientX,
          y: event.clientY,
        }
      },
      { once: true }
    )
  })
  await root.page().mouse.click(point.x, point.y)
  const event = await image.evaluate((image) => image.__retryPointer)
  expect(event).toMatchObject({ trusted: true, type: 'mouse' })
  expect(Math.abs(event.x - point.x)).toBeLessThan(1)
  expect(Math.abs(event.y - point.y)).toBeLessThan(1)
  await expect(root.locator('fieldset output')).toHaveText(
    position === 'letterbox'
      ? ''
      : `Selected point: ${Math.round(position.x * 100)}%, ${Math.round(position.y * 100)}%`
  )
  return { geometry, point, event, output: await root.locator('fieldset output').innerText() }
}

async function choose(root, question, correct) {
  const key = question.answerKey
  switch (question.kind) {
    case 'single-choice':
      await root
        .locator(
          `input[value="${correct ? key.optionId : question.options.find((option) => option.id !== key.optionId).id}"]`
        )
        .check()
      break
    case 'multi-choice': {
      for (const checkbox of await root.getByRole('checkbox').all()) await checkbox.uncheck()
      const ids = correct
        ? key.optionIds
        : [question.options.find((option) => !key.optionIds.includes(option.id)).id]
      for (const id of ids) await root.locator(`input[value="${id}"]`).check()
      break
    }
    case 'true-false':
      await root
        .getByRole('radio', {
          name: (correct ? key.value : !key.value) ? 'True' : 'False',
          exact: true,
        })
        .check()
      break
    case 'fill-blank': {
      const text = correct
        ? `  ${key.accepted[0].toUpperCase().normalize('NFD')}  `
        : 'Not an accepted answer'
      await root.getByRole('textbox', { name: 'Answer', exact: true }).fill(text)
      await expect(root.getByRole('textbox', { name: 'Answer', exact: true })).toHaveValue(text)
      break
    }
    case 'ordering':
      if (correct)
        for (const id of [...key.itemIds].reverse()) {
          const option = question.options.find((option) => option.id === id)
          const up = root.getByRole('button', { name: `Move ${option.text} up`, exact: true })
          for (
            let step = 0;
            step < question.options.length - 1 &&
            (await up.getAttribute('aria-disabled')) !== 'true';
            step++
          )
            await up.click()
        }
      expect(
        await root
          .locator('[data-ns-order-item]')
          .evaluateAll((rows) => rows.map((row) => row.dataset.nsOrderItem))
      ).toEqual(correct ? key.itemIds : question.options.map((option) => option.id))
      break
    case 'matching': {
      if (correct)
        for (const option of question.options.left) {
          await root.getByRole('button', { name: `Clear ${option.text}`, exact: true }).click()
        }
      if (correct) await expect(root.locator('[data-ns-assigned-label]')).toHaveText(['', ''])
      for (const [index, pair] of key.pairs.entries()) {
        const rightId = correct ? pair.rightId : key.pairs[(index + 1) % key.pairs.length].rightId
        await root.locator(`[data-ns-source="${pair.leftId}"]`).click()
        await root.locator(`[data-ns-target="${rightId}"]`).click()
        const label = question.options.right.find((option) => option.id === rightId).text
        await expect(
          root
            .locator(`[data-ns-source="${pair.leftId}"]`)
            .locator('..')
            .locator('[data-ns-assigned-label]')
        ).toHaveText(` → ${label}`)
      }
      break
    }
    case 'image-hotspot':
      return hotspotPoint(root, correct ? { x: 0.5, y: 0.5 } : { x: 0.1, y: 0.1 })
    default:
      throw new Error(`Unsupported quiz retry kind: ${question.kind}`)
  }
  return { controls: await root.locator('fieldset').innerText() }
}

export async function quizRetryJourney(root, question) {
  await expect(root.getByRole('heading', { name: question.prompt, exact: true })).toBeVisible()
  await assertState(root, 0, 0)
  const observed = {}
  if (question.kind === 'image-hotspot') {
    const image = root.locator('fieldset img')
    observed.media = await image.evaluate(async (image) => {
      await image.decode()
      return {
        src: image.currentSrc,
        alt: image.alt,
        width: image.naturalWidth,
        height: image.naturalHeight,
        complete: image.complete,
        objectFit: getComputedStyle(image).objectFit,
      }
    })
    expect(observed.media).toEqual({
      src: question.media.src,
      alt: question.media.alt,
      width: 160,
      height: 320,
      complete: true,
      objectFit: 'contain',
    })
    observed.letterbox = await hotspotPoint(root, 'letterbox')
    await assertState(root, 0, 0)
  }
  // Empty multi-choice and fill text are valid incorrect answers, not invalid payloads.
  const rejectedEmpty = {
    'single-choice': 'Select an existing option ID.',
    'true-false': 'Provide a boolean value.',
    matching: 'Include every item exactly once.',
    'image-hotspot': 'Select an existing candidate region ID.',
  }
  if (question.kind !== 'ordering') {
    await submit(root).click()
    await expect(status(root)).toContainText(
      rejectedEmpty[question.kind] || `Incorrect. ${question.feedback.incorrect}`
    )
    await assertState(root, rejectedEmpty[question.kind] ? 0 : 1, 0)
    await expect(submit(root)).toBeEnabled()
    observed.empty = await snapshot(root)
    if (!rejectedEmpty[question.kind]) await reset(root, question)
  } else
    observed.invalidBoundary =
      'Normal ordering controls preserve a complete permutation; no invalid permutation was injected.'
  observed.wrongInput = await choose(root, question, false)
  await submit(root).click()
  await expect(status(root)).toHaveText(`Incorrect. ${question.feedback.incorrect}`)
  await assertState(root, 1, 0)
  await expect(submit(root)).toBeEnabled()
  await expect(root.getByRole('button', { name: 'Finish quiz', exact: true })).toBeHidden()
  observed.wrong = await snapshot(root)
  observed.correctInput = await choose(root, question, true)
  await submit(root).click()
  await expect(status(root)).toHaveText(`Correct. ${question.feedback.correct}`)
  await assertState(root, 2, 10)
  await expect(submit(root)).toBeDisabled()
  await expect(root.getByText(question.feedback.explanation, { exact: true })).toBeVisible()
  observed.correct = await snapshot(root)
  // A second submission is not user-reachable once the one-time award disables Submit.
  await root.getByRole('button', { name: 'Finish quiz', exact: true }).click()
  await expect(status(root)).toHaveText('Quiz complete.')
  await expect(root.getByText('1 questions completed', { exact: true })).toBeVisible()
  await expect(root.getByText('Score: 10', { exact: true })).toBeVisible()
  await expect(submit(root)).toBeHidden()
  await expect(root.getByRole('button', { name: 'Finish quiz', exact: true })).toBeHidden()
  observed.completed = await snapshot(root)
  await reset(root, question)
  if (question.kind === 'matching')
    await expect(root.locator('[data-ns-assigned-label]')).toHaveText(['', ''])
  if (question.kind === 'ordering')
    expect(
      await root
        .locator('[data-ns-order-item]')
        .evaluateAll((rows) => rows.map((row) => row.dataset.nsOrderItem))
    ).toEqual(question.options.map((option) => option.id))
  if (question.kind === 'fill-blank')
    await expect(root.getByRole('textbox', { name: 'Answer', exact: true })).toHaveValue('')
  if (question.kind === 'image-hotspot')
    await expect(root.locator('fieldset output')).toHaveText('')
  for (const input of await root.locator('input[type="radio"], input[type="checkbox"]').all())
    await expect(input).not.toBeChecked()
  observed.reset = await snapshot(root)
  return observed
}
