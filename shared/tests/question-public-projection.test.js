import { describe, expect, it } from 'vitest'
import {
  projectPublicQuestion,
  validatePublicQuestion,
} from '../src/education/question-public-projection.js'

const privateQuestion = () => ({
  id: 'q',
  kind: 'single-choice',
  prompt: 'Choose',
  points: 10,
  timeLimit: 30,
  media: { src: '/question.png', alt: 'Diagram', privateNote: 'secret' },
  options: [
    { id: 'a', text: 'A', correct: true, media: { src: '/a.png', alt: 'A', answer: true } },
    { id: 'b', text: 'B', answerKey: 'secret' },
  ],
  answerKey: { optionId: 'a' },
  feedback: { correct: 'yes', incorrect: 'no', explanation: 'secret' },
  explanation: 'secret',
  correctIndex: 0,
  playerAnswers: ['private'],
})

describe('public question privacy boundary', () => {
  it('projects only public fields at every depth without mutating or retaining mutable source references', () => {
    const question = privateQuestion()
    const before = structuredClone(question)
    const publicQuestion = projectPublicQuestion(question)
    expect(publicQuestion).toEqual({
      id: 'q',
      kind: 'single-choice',
      prompt: 'Choose',
      points: 10,
      timeLimit: 30,
      media: { src: '/question.png', alt: 'Diagram' },
      options: [
        { id: 'a', text: 'A', media: { src: '/a.png', alt: 'A' } },
        { id: 'b', text: 'B' },
      ],
    })
    expect(question).toEqual(before)
    publicQuestion.options[0].text = 'Edited'
    publicQuestion.media.alt = 'Edited'
    expect(question.options[0].text).toBe('A')
    expect(question.media.alt).toBe('Diagram')
  })

  it('validates a public shape independently of any private answer key', () => {
    const publicQuestion = projectPublicQuestion(privateQuestion())
    expect(validatePublicQuestion(publicQuestion)).toEqual({ isValid: true, errors: [] })
    const fill = { id: 'fill', kind: 'fill-blank', prompt: 'Capital?', points: 0, timeLimit: null }
    expect(validatePublicQuestion(fill)).toEqual({ isValid: true, errors: [] })
  })

  it.each(['answerKey', 'feedback', 'correctIndex', 'explanation', 'privateField'])(
    'rejects leaked %s fields rather than silently sanitizing',
    (field) => {
      const question = projectPublicQuestion(privateQuestion())
      question[field] = 'secret'
      expect(validatePublicQuestion(question).errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: [field] })])
      )
    }
  )

  it.each([
    [
      (q) => {
        q.options[0].correct = true
      },
      ['options', 0, 'correct'],
    ],
    [
      (q) => {
        q.options[0].id = 'b'
      },
      ['options', 1, 'id'],
    ],
    [
      (q) => {
        q.options[0].text = 3
      },
      ['options', 0, 'text'],
    ],
    [
      (q) => {
        q.options[0].media.src = 'javascript:alert(1)'
      },
      ['options', 0, 'media', 'src'],
    ],
    [
      (q) => {
        q.media.alt = 4
      },
      ['media', 'alt'],
    ],
    [
      (q) => {
        q.media.answerKey = 'secret'
      },
      ['media', 'answerKey'],
    ],
  ])('rejects malformed or leaked nested public data', (change, path) => {
    const question = projectPublicQuestion(privateQuestion())
    change(question)
    expect(validatePublicQuestion(question).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })])
    )
  })

  it('projects matching item images and neutral hotspot candidate identities without revealing correct regions', () => {
    const matching = {
      ...privateQuestion(),
      kind: 'matching',
      options: {
        left: [{ id: 'l', text: 'Left', correct: true }],
        right: [{ id: 'r', text: 'Right', media: { src: '/r.png', alt: 'Right' } }],
      },
      answerKey: { pairs: [{ leftId: 'l', rightId: 'r' }] },
    }
    expect(projectPublicQuestion(matching).options).toEqual({
      left: [{ id: 'l', text: 'Left' }],
      right: [{ id: 'r', text: 'Right', media: { src: '/r.png', alt: 'Right' } }],
    })
    const hotspot = {
      ...privateQuestion(),
      kind: 'image-hotspot',
      options: [
        { id: 'target', text: 'North' },
        { id: 'neutral', text: 'South' },
      ],
      answerKey: { regions: [{ id: 'target', shape: 'rect', x: 0, y: 0, width: 1, height: 0.5 }] },
    }
    expect(projectPublicQuestion(hotspot)).toEqual({
      id: 'q',
      kind: 'image-hotspot',
      prompt: 'Choose',
      points: 10,
      timeLimit: 30,
      media: { src: '/question.png', alt: 'Diagram' },
      options: [
        { id: 'target', text: 'North' },
        { id: 'neutral', text: 'South' },
      ],
    })
  })

  it('rejects unsafe media at projection instead of passing invalid public content downstream', () => {
    const question = privateQuestion()
    question.media.src = 'data:text/html;base64,WA=='
    expect(() => projectPublicQuestion(question)).toThrow(/media.src/)
  })
})
