import { expect } from '@playwright/test'
import generator from '../../../shared/src/education/word-search-generator.js'
import { matchMemory } from './release-memory-interaction.js'
const { generateWordSearch } = generator

export async function playUtility(root, type, config) {
  let countdownBaseline
  if (type === 'name-picker' || type === 'lucky-wheel') {
    await root
      .locator(`[data-ns-command="${type === 'name-picker' ? 'pick' : 'spin'}"]`)
      .press('Enter')
    await expect
      .poll(() => root.locator('[data-ns-winner]').innerText(), {
        timeout: config.animationDuration + 5000,
      })
      .toMatch(
        new RegExp(
          `^(${config.items.map((item) => item.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`
        )
      )
    const remaining =
      config.items.length -
      (type === 'name-picker' ? Number(config.excludeAfterPick) : Number(config.removeAfterPick))
    await expect(root).toContainText(
      type === 'name-picker'
        ? `${remaining} names available`
        : remaining
          ? `${remaining} prizes available`
          : 'No prizes left'
    )
  } else if (type === 'countdown') {
    countdownBaseline = await root.locator('[data-ns-countdown]').innerText()
    await root.getByRole('button', { name: 'Start', exact: true }).click()
    await root.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(root.getByRole('button', { name: 'Resume', exact: true })).toBeEnabled()
    await expect(root.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled()
    await root.getByRole('button', { name: 'Resume', exact: true }).click()
    await expect(root.locator('div[role="status"]')).toHaveText(config.expiryMessage, {
      timeout: config.durationSeconds * 1000 + 5000,
    })
    await expect(root.locator('[data-ns-countdown]')).toContainText('00:00')
  } else if (type === 'scoreboard') {
    await root
      .getByRole('button', {
        name: `Increase ${config.teams[0].name} score by ${config.step}`,
        exact: true,
      })
      .click()
    await expect(root.locator(`[data-ns-score="${config.teams[0].id}"]`)).toHaveText(
      String(config.teams[0].initialScore + config.step)
    )
    await root
      .getByRole('button', {
        name: `Decrease ${config.teams[0].name} score by ${config.step}`,
        exact: true,
      })
      .click()
    await expect(root.locator(`[data-ns-score="${config.teams[0].id}"]`)).toHaveText(
      String(config.teams[0].initialScore)
    )
    await root
      .getByRole('button', {
        name: `Increase ${config.teams[0].name} score by ${config.step}`,
        exact: true,
      })
      .click()
  } else if (type === 'memory') {
    await matchMemory(root, config)
  } else if (type === 'flashcards') {
    for (const [index, card] of config.cards.entries()) {
      await expect(root.getByRole('group', { name: 'Card front', exact: true })).toContainText(
        card.front.text
      )
      await root
        .getByRole('button', { name: `Show back of card ${index + 1}`, exact: true })
        .press('Space')
      await expect(root.getByRole('group', { name: 'Card back', exact: true })).toContainText(
        card.back.text
      )
      if (index < config.cards.length - 1)
        await root.getByRole('button', { name: 'Next', exact: true }).click()
    }
    await expect(root.locator('[data-ns-flashcards-progress]')).toContainText(
      `${config.cards.length} / ${config.cards.length} studied`
    )
  } else if (type === 'sorting') {
    for (const pair of config.answerKey.assignments) {
      await root.locator(`[data-ns-source="${pair.itemId}"]`).press('Enter')
      await root.locator(`[data-ns-target="${pair.bucketId}"]`).press('Space')
    }
    await root.getByRole('button', { name: 'Check sorting', exact: true }).click()
    await expect(root.getByRole('button', { name: 'Check sorting', exact: true })).toBeDisabled()
    await expect(root).toContainText(`Score: ${config.points}`)
  } else if (type === 'crossword') {
    const values = new Map()
    for (const entry of config.entries)
      [...entry.answer].forEach((letter, i) => {
        const row = entry.row + (entry.direction === 'down' ? i : 0)
        const column = entry.column + (entry.direction === 'across' ? i : 0)
        values.set(`${row}:${column}`, letter)
      })
    for (const [position, letter] of values) {
      const [row, column] = position.split(':')
      await root.locator(`input[data-row="${row}"][data-column="${column}"]`).fill(letter)
    }
    await root.getByRole('button', { name: 'Check answers', exact: true }).click()
    await expect(root).toContainText('Crossword complete!')
  } else if (type === 'word-search') {
    const puzzle = generateWordSearch(config)
    for (const entry of puzzle.placements) {
      const first = entry.path[0],
        last = entry.path.at(-1)
      await root.locator(`[data-row="${first.row}"][data-column="${first.column}"]`).press('Space')
      await root.locator(`[data-row="${last.row}"][data-column="${last.column}"]`).press('Space')
      await root.getByRole('button', { name: 'Submit selected path', exact: true }).click()
    }
    await expect(root).toContainText('All words found!')
  } else throw new Error(`No real utility journey for ${type}`)
  const completed = await root.innerText()
  await root
    .getByRole('button', { name: type === 'sorting' ? 'Reset sorting' : 'Reset', exact: true })
    .click()
  const reset = await root.innerText()
  if (type === 'memory')
    await expect(root.locator('[data-ns-memory-progress]')).toContainText(
      `0 / ${config.pairs.length} pairs matched · 0 attempts · 0 points`
    )
  if (type === 'flashcards')
    await expect(root.locator('[data-ns-flashcards-progress]')).toContainText(
      `Card 1 / ${config.cards.length} · 0 / ${config.cards.length} studied`
    )
  if (type === 'crossword') await expect(root.locator('input').first()).toHaveValue('')
  if (type === 'word-search') await expect(root).toContainText(`0/${config.words.length} found`)
  if (type === 'countdown') {
    await expect(root.getByRole('button', { name: 'Start', exact: true })).toBeEnabled()
    await expect(root.locator('[data-ns-countdown]')).toHaveText(countdownBaseline)
  }
  if (type === 'scoreboard')
    await expect(root.locator('[data-ns-score]').first()).toHaveText(
      String(config.teams[0].initialScore)
    )
  if (type === 'sorting')
    await expect(root).toContainText(`Score: 0. Attempts: 0/${config.attemptLimit}.`)
  if (type === 'name-picker')
    await expect(root.locator('[data-ns-winner]')).toHaveText('Choose a name')
  if (type === 'lucky-wheel')
    await expect(root.locator('[data-ns-wheel-remaining]')).toHaveText(
      `${config.items.length} prizes available`
    )
  return { completed, reset }
}
