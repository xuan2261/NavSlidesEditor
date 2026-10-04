import { test, expect } from '@playwright/test'
import { liveJourney, nativeAnswer } from './education-player-fixture.js'
const legacy = {
  id: 'q1',
  question: 'Which planet is blue?',
  options: ['Mars', 'Earth'],
  correctIndex: 1,
  points: 10,
  timeLimit: 30,
}
const canonical = {
  id: 'q2',
  kind: 'single-choice',
  prompt: 'Choose the blue planet again',
  options: [
    { id: 'earth', text: 'Earth' },
    { id: 'mars', text: 'Mars' },
  ],
  answerKey: { optionId: 'earth' },
  points: 10,
  timeLimit: 30,
  feedback: { correct: '', incorrect: '', explanation: 'Earth is our home.' },
}
test('saved legacy and canonical HotPotato questions reach generated host and native learners with stable receipts', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const args = { page, request, browser, baseURL }
  const journey = await liveJourney(args, 'hot-potato', {
    questions: [legacy, canonical],
    allowLate: false,
    shuffleQuestions: false,
  })
  try {
    const savedResponse = await args.request.get(`/api/presentations/${journey.deck.id}`)
    expect(savedResponse.ok()).toBe(true)
    const saved = await savedResponse.json()
    expect(saved.slides[0].elements[0]['hot-potato'].questions[0].prompt).toBe(legacy.question)
    await journey.command('nextQuestion')
    await expect(journey.learners[0].getByRole('heading', { name: legacy.question })).toBeVisible()
    await nativeAnswer(journey.learners[0])
    await expect(journey.learners[0].getByText('Correct.', { exact: true })).toBeVisible()
    await journey.learners[0].reload()
    await expect(journey.learners[0].getByText('Correct.', { exact: true })).toBeVisible()
    await journey.command('nextQuestion')
    await expect(journey.learners[0].getByRole('heading', { name: canonical.prompt })).toBeVisible()
    await nativeAnswer(journey.learners[0], 'Mars')
    await expect(journey.learners[0].getByText(/Incorrect/)).toBeVisible()
    await journey.command('reveal')
    await expect(journey.learners[0].getByText('Answer: Earth')).toBeVisible()
    await journey.learners[0].reload()
    await expect(journey.learners[0].getByText('Answer: Earth')).toBeVisible()
  } finally {
    await journey.close()
  }
})
