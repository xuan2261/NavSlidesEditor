import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { renderElement } from '../src/element-renderers.js'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'

const base = { id: 'snapshot-game', type: 'game', x: 0, y: 0, width: 800, height: 480 }
const documentFor = (element, options = {}) =>
  new JSDOM(renderElement(element, {}, { forPrint: true, ...options })).window.document

describe('canonical authored game snapshots', () => {
  it('displays the canonical prompt and safe image without exposing private answers or creating active content', () => {
    const config = createDefaultGameConfig('hot-potato')
    config.questions[0] = {
      ...config.questions[0],
      prompt: 'Chọn <script>window.attack=1</script> Paris',
      media: { src: '/uploads/paris.png', alt: 'Bản đồ Paris' },
      answerKey: { optionId: config.questions[0].options[0].id },
      feedback: {
        correct: 'PRIVATE_CORRECT',
        incorrect: 'PRIVATE_WRONG',
        explanation: 'PRIVATE_EXPLANATION',
      },
    }
    const document = documentFor({ ...base, gameType: 'hot-potato', 'hot-potato': config })
    expect(document.body.textContent).toContain(config.questions[0].prompt)
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/uploads/paris.png')
    expect(document.querySelector('img')?.getAttribute('alt')).toBe('Bản đồ Paris')
    expect(document.querySelector('script, button, input')).toBeNull()
    expect(document.body.textContent).not.toMatch(/PRIVATE_|answerKey/)
  })

  it('retains canonical picker labels and board categories/questions in inert printable content', () => {
    const picker = createDefaultGameConfig('name-picker')
    picker.items = [
      { id: 'ada', label: 'Nguyễn An', weight: 3 },
      { id: 'lin', label: 'Linh', weight: 1 },
    ]
    const pickerDocument = documentFor({ ...base, gameType: 'name-picker', 'name-picker': picker })
    expect(pickerDocument.body.textContent).toContain('Nguyễn An')
    expect(pickerDocument.body.textContent).toContain('Linh')
    expect(pickerDocument.body.textContent).not.toContain('[object Object]')
    const board = createDefaultGameConfig('jeopardy')
    board.categories[0].title = 'Địa lý Việt Nam'
    board.categories[0].questions[0].prompt = 'Thủ đô Việt Nam?'
    const boardDocument = documentFor(
      { ...base, gameType: 'jeopardy', jeopardy: board },
      { forPrint: true }
    )
    expect(boardDocument.body.textContent).toContain('Địa lý Việt Nam')
    expect(boardDocument.body.textContent).toContain('Thủ đô Việt Nam?')
    expect(boardDocument.querySelector('button, input, script')).toBeNull()
  })
})
