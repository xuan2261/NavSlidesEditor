import { expect } from '@playwright/test'

const content = {
  'name-picker': 'Authored winner',
  'lucky-wheel': 'Authored winner',
  'hot-potato': 'What is the capital of France?',
  jeopardy: 'Geography',
  'four-corners': 'What is the capital of France?',
  'relay-race': 'What is the capital of France?',
  'trivia-champ': 'Round 1',
  scattergories: 'Food',
  poll: 'What do you think?',
  'word-cloud': 'Share one word or short phrase',
  matching: 'France',
  countdown: 'Time is up!',
  scoreboard: 'Blue',
  memory: 'Memory',
  flashcards: 'Capital of France?',
  sorting: 'Apple',
  crossword: 'A small feline',
  'word-search': 'CAT',
}
const solution = {
  'hot-potato': /\bAnswer\b/i,
  jeopardy: /\bAnswer\b/i,
  'four-corners': /\bAnswer\b/i,
  'relay-race': /\bAnswer\b/i,
  'trivia-champ': /\bAnswer\b/i,
  matching: /\bMatches\b/i,
  memory: /\bParis\b/i,
  flashcards: /\bParis\b/i,
  sorting: /\bAssignments\b/i,
  crossword: /\bCAT\b/i,
}
const quizSolutions = {
  'single-choice': /\bAnswer\b/i,
  'multi-choice': /\bAnswers\b/i,
  'true-false': /\bAnswer\b/i,
  'fill-blank': /Accepted answers/i,
  ordering: /Correct order/i,
  matching: /\bMatch\b/i,
  'image-hotspot': /Answer regions/i,
}
export function assertStaticGame(observed, type, kind, reveal, previous = null) {
  const text = observed.text.replace(/\s+/g, ' ')
  expect(text.toLowerCase()).toContain(
    (type === 'quiz' ? `Authored ${kind} question` : content[type]).toLowerCase()
  )
  const marker = type === 'quiz' ? quizSolutions[kind] : solution[type]
  if (marker) {
    if (reveal) expect(text).toMatch(marker)
    else expect(text).not.toMatch(marker)
  }
  if (type === 'memory' && !reveal) expect(text).not.toMatch(/\bFrance\b|\bRome\b/)
  if (type === 'crossword' && !reveal) expect(text).not.toMatch(/\bCAR\b/)
  if (type === 'word-search' || (type === 'quiz' && kind === 'image-hotspot')) {
    if (reveal) expect(observed.solutionPixels).toBeGreaterThan(previous.solutionPixels + 30)
  }
  expect(observed.warning).toMatch(/static|rasterized|interactive controls/i)
  return {
    text,
    solutionPixels: observed.solutionPixels,
    marker: marker?.source || null,
    teacherReveal: reveal,
    pageCount: observed.pageCount,
    slideCount: observed.slideCount,
    warning: observed.warning,
    ocr: observed.ocr,
  }
}
export const ordinaryStaticText = {
  text: 'Bold term',
  image: 'Authored citation',
  shape: 'Authored shape label',
  code: 'const lesson = 19;',
  latex: 'E',
  html: 'Increment lesson',
  markdown: 'Authored markdown',
  chart: 'Authored series',
  video: 'Video',
  audio: 'Audio',
  table: 'Authored heading',
  callout: '19',
  timeline: 'Authored event',
  game: 'Authored winner',
}
