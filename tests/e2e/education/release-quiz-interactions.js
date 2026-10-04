import { expect } from '@playwright/test'

export async function answerQuestion(root, question) {
  const key = question.answerKey
  switch (question.kind) {
    case 'single-choice':
      await root.locator(`input[value="${key.optionId}"]`).check()
      break
    case 'multi-choice':
      for (const id of key.optionIds) await root.locator(`input[value="${id}"]`).check()
      break
    case 'true-false':
      await root.getByRole('radio', { name: key.value ? 'True' : 'False', exact: true }).check()
      break
    case 'fill-blank':
      await root.getByRole('textbox', { name: 'Answer', exact: true }).fill(key.accepted[0])
      break
    case 'ordering':
      for (let index = key.itemIds.length - 1; index >= 0; index--) {
        const item = question.options.find((item) => item.id === key.itemIds[index])
        const row = root.locator(`[data-ns-order-item="${item.id}"]`)
        while (
          await row.getByRole('button', { name: `Move ${item.text} up`, exact: true }).isEnabled()
        ) {
          await row.getByRole('button', { name: `Move ${item.text} up`, exact: true }).click()
        }
      }
      break
    case 'matching':
      for (const pair of key.pairs) {
        await root.locator(`[data-ns-source="${pair.leftId}"]`).press('Enter')
        await root.locator(`[data-ns-target="${pair.rightId}"]`).press('Space')
      }
      break
    case 'image-hotspot':
      await root
        .getByRole('combobox', { name: 'Named region', exact: true })
        .selectOption(key.regions[0].id)
      await expect(root.locator('img')).toHaveJSProperty('complete', true)
      break
    default:
      throw new Error(`No real answer journey for ${question.kind}`)
  }
  await root.getByRole('button', { name: 'Submit answer', exact: true }).click()
}

export async function playQuiz(root, config) {
  let score = 0
  const quizStatus = root.locator('[data-ns-game-ui] > [role="status"]')
  for (const [index, question] of config.questions.entries()) {
    await expect(root.getByRole('heading', { name: question.prompt, exact: true })).toBeVisible()
    await answerQuestion(root, question)
    if (question.feedback?.correct)
      await expect(quizStatus).toContainText(question.feedback.correct)
    score += question.points
    await expect(root).toContainText(`Score: ${score}`)
    await root
      .getByRole('button', {
        name: index < config.questions.length - 1 ? 'Next question' : 'Finish quiz',
        exact: true,
      })
      .click()
  }
  await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeHidden()
  await expect(root.getByRole('button', { name: 'Finish quiz', exact: true })).toBeHidden()
  const completed = await root.innerText()
  await root.getByRole('button', { name: 'Reset quiz', exact: true }).click()
  await expect(root).toContainText('Score: 0')
  await expect(
    root.getByRole('heading', { name: config.questions[0].prompt, exact: true })
  ).toBeVisible()
  await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeEnabled()
  return { completed, reset: await root.innerText() }
}

export async function playClassroom(root, type, config) {
  await root.getByRole('textbox', { name: 'Participant name', exact: true }).fill('Release learner')
  await root.getByRole('button', { name: 'Add participant', exact: true }).click()
  await root.getByRole('button', { name: 'Start', exact: true }).click()
  if (type === 'poll') {
    await root.getByRole('radio', { name: config.options[0].text, exact: true }).check()
    await root.getByRole('button', { name: 'Submit vote', exact: true }).click()
    await root.getByRole('radio', { name: config.options[1].text, exact: true }).check()
    await root.getByRole('button', { name: 'Submit vote', exact: true }).click()
  } else if (type === 'word-cloud') {
    await root
      .getByRole('textbox', { name: 'Word or phrase', exact: true })
      .fill('Authored learning')
    await root.getByRole('button', { name: 'Submit phrase', exact: true }).click()
  } else {
    for (const pair of config.pairs) {
      await root.locator(`[data-ns-source="${pair.promptId}"]`).press('Enter')
      await root.locator(`[data-ns-target="${pair.targetId}"]`).press('Space')
    }
    await root.getByRole('button', { name: 'Submit matches', exact: true }).click()
    await expect(root.locator('.ns-classroom-controls [role="status"]')).toContainText(
      `${config.pairs.length} / ${config.pairs.length} pairs correct`
    )
  }
  await root.getByRole('button', { name: 'Reveal results', exact: true }).click()
  const results = root.locator('[data-ns-results]')
  if (type === 'poll') await expect(results).toContainText(`${config.options[1].text}: 1`)
  else if (type === 'word-cloud') await expect(results).toContainText('authored learning')
  else await expect(results).toContainText('Release learner')
  const completed = await root.innerText()
  if (type === 'word-cloud') {
    await root.getByRole('button', { name: 'Clear words', exact: true }).click()
    await expect(results).not.toContainText('authored learning')
  }
  await root.getByRole('button', { name: 'Reset', exact: true }).click()
  if (type === 'poll') await expect(results).not.toContainText(`${config.options[1].text}: 1`)
  else
    await expect(results).not.toContainText(
      type === 'word-cloud' ? 'authored learning' : 'Release learner'
    )
  await expect(
    root.getByRole('combobox', { name: 'Current participant', exact: true })
  ).toBeDisabled()
  return { completed, reset: await root.innerText() }
}
