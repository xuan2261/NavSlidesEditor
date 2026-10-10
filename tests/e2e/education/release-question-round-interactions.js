import { expect } from '@playwright/test'
import { answerQuestion } from './release-quiz-interactions.js'

export async function playQuestionRound(root, type, config) {
  if (type === 'jeopardy') {
    await root.locator(`[data-ns-command="team-${config.teams[0].id}"]`).click()
    let score = 0
    for (const category of config.categories)
      for (const question of category.questions) {
        await root.locator(`[data-ns-command="cell-${question.id}"]`).click()
        await expect(
          root.getByRole('heading', { name: question.prompt, exact: true })
        ).toBeVisible()
        await expect(root.locator('[data-ns-answer]')).toBeHidden()
        await root.locator('[data-ns-command="show-answer"]').click()
        await expect(root.locator('[data-ns-answer]')).toContainText(
          question.options.find((option) => option.id === question.answerKey.optionId).text
        )
        await root.locator('[data-ns-command="correct"]').click()
        score += question.points
        await expect(root.locator('[aria-label="Scores"]')).toContainText(
          `${config.teams[0].name}: ${score}`
        )
        await expect(root.locator(`[data-ns-cell="${question.id}"]`)).toBeDisabled()
      }
    await expect(root.getByRole('status')).toContainText('wins!')
  } else {
    await root.getByRole('textbox', { name: 'Participant ID', exact: true }).fill('release-learner')
    await root
      .getByRole('textbox', { name: 'Participant name', exact: true })
      .fill('Release learner')
    await root.locator('[data-ns-command="add-participant"]').click()
    await root.locator('[data-ns-command="start"]').click()
    let points = 0,
      maximum = 0
    for (const question of config.questions) {
      if (type === 'hot-potato') {
        await answerQuestion(root, question)
        await expect(root.getByRole('status')).toContainText(
          question.feedback.correct || 'Correct!'
        )
        points += question.points
        maximum += question.points * (question.timeLimit > 0 ? 2 : 1)
        const scoreText = await root.locator('[aria-label="Participant score"]').innerText()
        expect(scoreText).toMatch(/^Release learner: \d+ points$/)
        const awarded = Number(scoreText.match(/: (\d+) points$/)[1])
        expect(awarded).toBeGreaterThanOrEqual(points)
        expect(awarded).toBeLessThanOrEqual(maximum)
        await expect(root.locator('[data-ns-command="submit-answer"]')).toBeDisabled()
      } else {
        await root
          .locator(`[data-ns-command="corner-${question.answerKey.optionId}"]`)
          .press('Space')
        await expect(
          root.locator(`[data-ns-command="corner-${question.answerKey.optionId}"]`)
        ).toHaveAttribute('aria-pressed', 'true')
      }
      await root.locator('[data-ns-command="reveal"]').click()
      if (type === 'four-corners') {
        await expect(root).toContainText(
          `Correct corner: ${question.options.find((option) => option.id === question.answerKey.optionId).text}`
        )
        points += question.points
        await expect(root.locator('[aria-label="Participant scores"]')).toContainText(
          `Release learner: ${points}`
        )
      } else
        await expect(root).toContainText(
          `Answer: ${question.options.find((option) => option.id === question.answerKey.optionId).text}`
        )
      await root.locator('[data-ns-command="next"]').click()
    }
    await expect(root.getByRole('status')).toHaveText('Game ended.')
  }
  const completed = await root.innerText()
  await root.locator('[data-ns-command="reset"]').click()
  const reset = await root.innerText()
  let postResetScore = null
  if (type === 'jeopardy') {
    await expect(root.locator('[aria-label="Scores"]')).toContainText(`${config.teams[0].name}: 0`)
    await expect(root.locator('[data-ns-cell]').first()).toBeEnabled()
  } else {
    await expect(root.locator('[data-ns-command="start"]')).toBeDisabled()
    await expect(
      root.getByRole('combobox', { name: 'Current participant', exact: true })
    ).toHaveValue('')
    if (type === 'four-corners')
      await expect(root.locator('[aria-label="Participant scores"]')).toBeEmpty()
    await root.getByRole('textbox', { name: 'Participant ID', exact: true }).fill('release-learner')
    await root
      .getByRole('textbox', { name: 'Participant name', exact: true })
      .fill('Release learner')
    await root.locator('[data-ns-command="add-participant"]').click()
    const score = root.locator(
      type === 'hot-potato'
        ? '[aria-label="Participant score"]'
        : '[aria-label="Participant scores"]'
    )
    await expect(score).toContainText(
      type === 'hot-potato' ? 'Release learner: 0 points' : 'Release learner: 0'
    )
    postResetScore = await score.innerText()
  }
  return { completed, reset, postResetScore }
}
