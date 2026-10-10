import { expect } from '@playwright/test'
import { answerQuestion } from './release-quiz-interactions.js'

export async function playRoundGame(root, type, config) {
  let relay
  if (type === 'relay-race') {
    const position = (team) =>
      root.getByRole('progressbar', { name: `${team.name} position`, exact: true })
    const readPositions = async () =>
      Object.fromEntries(
        await Promise.all(
          config.teams.map(async (team) => [
            team.id,
            await position(team).evaluate((node) => node.value),
          ])
        )
      )
    const expectedPositions = Object.fromEntries(config.teams.map((team) => [team.id, 0]))
    for (const team of config.teams)
      await expect(position(team)).toHaveAttribute('max', String(config.questionsPerRound))
    await expect.poll(readPositions).toEqual(expectedPositions)
    const authoredConfig = root.locator('script[data-ns-game-config]')
    expect(JSON.parse(await authoredConfig.textContent())).toEqual(config)
    await root.getByRole('button', { name: 'Start race', exact: true }).click()
    let winner,
      turns = 0
    for (; turns < config.questionsPerRound * config.teams.length; turns++) {
      await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeVisible()
      const announcement = await root.getByRole('status').textContent()
      const active = [...config.teams]
        .sort((a, b) => b.name.length - a.name.length)
        .find((team) => announcement.startsWith(`${team.name}:`))
      expect(active, 'The playable turn must identify an authored active team').toBeDefined()
      const prompt = await root.getByRole('heading', { level: 4 }).textContent()
      const question = config.questions.find((question) => question.prompt === prompt)
      expect(question, 'The playable turn must ask an authored question').toBeDefined()
      await answerQuestion(root, question)
      expectedPositions[active.id]++
      await expect.poll(readPositions).toEqual(expectedPositions)
      if (expectedPositions[active.id] === config.questionsPerRound) {
        winner = active
        turns++
        break
      }
    }
    expect(
      winner,
      'Correct authored answers must finish the race within the bounded team turns'
    ).toBeDefined()
    await expect(position(winner)).toHaveAttribute('value', String(config.questionsPerRound))
    await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toHaveCount(0)
    await expect(root.getByRole('button', { name: 'Pass baton', exact: true })).toHaveCount(0)
    await expect(root.getByRole('button', { name: 'Start race', exact: true })).toHaveCount(0)
    await expect(root.getByRole('timer', { name: 'Time remaining', exact: true })).toHaveText('')
    expect(JSON.parse(await authoredConfig.textContent())).toEqual(config)
    relay = {
      winnerId: winner.id,
      positions: { ...expectedPositions },
      turns,
      questionsPerRound: config.questionsPerRound,
      shuffleTeams: config.shuffleTeams,
    }
  } else if (type === 'trivia-champ') {
    await root.getByRole('button', { name: 'Start championship', exact: true }).click()
    let score = 0
    for (const round of config.rounds)
      for (const id of round.questionIds) {
        const question = config.questions.find((question) => question.id === id)
        if (config.jackpotRound.enabled)
          await root
            .getByRole('button', {
              name: `Jackpot ×${config.jackpotRound.multiplier}`,
              exact: true,
            })
            .click()
        if (round.mode === 'buzzer')
          await root
            .getByRole('button', { name: `Buzz: ${config.teams[0].name}`, exact: true })
            .click()
        else
          await root
            .getByRole('combobox', {
              name: round.mode === 'individual' ? 'Answering participant team' : 'Answering team',
              exact: true,
            })
            .selectOption(config.teams[0].id)
        await answerQuestion(root, question)
        await expect(root.getByRole('status')).toHaveText('Correct answer.')
        score +=
          question.points * (config.jackpotRound.enabled ? config.jackpotRound.multiplier : 1) +
          (round.mode === 'buzzer' ? config.buzzPoints : 0)
        await expect(root.locator('[aria-label="Scores"]')).toContainText(
          `${config.teams[0].name}: ${score}`
        )
        await root.getByRole('button', { name: 'Next question / round', exact: true }).click()
      }
    await expect(root.getByRole('status')).toContainText(`${config.teams[0].name} wins!`)
  } else if (type === 'scattergories') {
    await root
      .getByRole('button', {
        name: config.letterMode === 'random' ? 'Choose random letter and start' : 'Start round',
        exact: true,
      })
      .click()
    const letter = (await root.locator('h4').innerText()).match(/starts with ([A-Z])/)[1]
    for (const category of config.categories)
      for (const [index, team] of config.teams.entries()) {
        await root
          .getByRole('textbox', { name: `${category.label}: ${team.name}`, exact: true })
          .fill(`${letter}uthored-${index}`)
      }
    await root.getByRole('button', { name: 'Score now', exact: true }).click()
    for (const team of config.teams)
      await expect(root.locator('[aria-label="Round scores"]')).toContainText(
        `${team.name}: ${config.categories.length}`
      )
    await expect(root.getByRole('status')).toContainText('Review complete.')
  } else throw new Error(`Missing real presenter contract for ${type}`)
  const completed = await root.innerText()
  await root.getByRole('button', { name: 'Reset', exact: true }).click()
  if (type === 'relay-race') {
    await expect(root.getByRole('button', { name: 'Start race', exact: true })).toBeEnabled()
    for (const team of config.teams) {
      const position = root.getByRole('progressbar', { name: `${team.name} position`, exact: true })
      await expect(position).toHaveAttribute('value', '0')
      await expect(position).toHaveAttribute('max', String(config.questionsPerRound))
    }
    expect(JSON.parse(await root.locator('script[data-ns-game-config]').textContent())).toEqual(
      config
    )
  }
  if (type === 'trivia-champ') {
    await expect(
      root.getByRole('button', { name: 'Start championship', exact: true })
    ).toBeEnabled()
    await expect(root.locator('[aria-label="Scores"]')).toContainText(`${config.teams[0].name}: 0`)
  }
  if (type === 'scattergories')
    await expect(
      root.getByRole('button', {
        name: config.letterMode === 'random' ? 'Choose random letter and start' : 'Start round',
        exact: true,
      })
    ).toBeEnabled()
  return { completed, reset: await root.innerText(), ...(relay ? { relay } : {}) }
}
