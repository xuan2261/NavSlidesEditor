import { pathToFileURL } from 'node:url'
import shared from 'revealjs-shared'
import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
const q = {
  id: 'q',
  kind: 'single-choice',
  prompt: 'Choose Earth',
  points: 10,
  timeLimit: null,
  options: [
    { id: 'earth', text: 'Earth' },
    { id: 'mars', text: 'Mars' },
  ],
  answerKey: { optionId: 'earth' },
  feedback: { correct: 'Correct', incorrect: 'Wrong', explanation: 'Earth is our home.' },
}
test('normal downloaded file has honest local quiz, playable reset and no phone room/network fallback', async ({
  page,
  request,
  browser,
  testPresentation,
}, info) => {
  await apiUpdatePresentation(request, testPresentation.id, {
    slides: [
      {
        id: 'quiz-slide',
        elements: [
          {
            id: 'quiz',
            type: 'game',
            gameType: 'quiz',
            x: 30,
            y: 30,
            width: 640,
            height: 480,
            quiz: { ...shared.createDefaultGameConfig('quiz'), questions: [q] },
          },
        ],
      },
      {
        id: 'memory-slide',
        elements: [
          {
            id: 'memory',
            type: 'game',
            gameType: 'memory',
            x: 30,
            y: 30,
            width: 640,
            height: 480,
            memory: shared.createDefaultGameConfig('memory'),
          },
        ],
      },
    ],
  })
  await page.goto(`/editor/${testPresentation.id}`)
  await expect(page.getByRole('textbox', { name: 'Presentation title' })).toBeVisible()
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export HTML', exact: true }).click()
  const download = await downloading,
    output = info.outputPath('education-native-local.html')
  await download.saveAs(output)
  const context = await browser.newContext({ offline: true, reducedMotion: 'reduce' })
  try {
    const file = await context.newPage(),
      requests = [],
      sockets = []
    file.on('request', (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url())
    })
    file.on('websocket', (socket) => sockets.push(socket.url()))
    await file.goto(pathToFileURL(output).href)
    await file.waitForFunction(() => typeof NavSlidesEducation !== 'undefined' && Reveal.isReady())
    const root = file.locator('[data-ns-element-id="quiz"]')
    await expect(root).toContainText('Local classroom')
    await expect(file.locator('[data-ns-learner-join]')).toHaveCount(0)
    await root.getByRole('radio', { name: 'Earth', exact: true }).check()
    await root.getByRole('button', { name: 'Submit answer' }).click()
    await expect(root).toContainText('Correct.')
    await expect
      .poll(() => root.evaluate((root) => NavSlidesEducation.mount(root).getState().score))
      .toBe(10)
    await root.getByRole('button', { name: 'Reset quiz' }).click()
    await expect
      .poll(() => root.evaluate((root) => NavSlidesEducation.mount(root).getState().score))
      .toBe(0)
    await file.evaluate(() => Reveal.slide(1))
    const memory = file.locator('[data-ns-element-id="memory"]')
    await expect(memory).toBeVisible()
    await expect(memory.locator('[data-ns-learner-join]')).toHaveCount(0)
    expect(requests).toEqual([])
    expect(sockets).toEqual([])
  } finally {
    await context.close()
  }
})
