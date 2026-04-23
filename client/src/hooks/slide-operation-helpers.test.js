import { describe, expect, it } from 'vitest'

import {
  clampSlideIndex,
  deleteSlidesAtIndices,
  duplicateSlidesAtIndices,
} from './slide-operation-helpers'

function createSlide(id, label = id) {
  return {
    id,
    elements: [
      {
        id: `${id}-element`,
        type: 'text',
        content: `<p>${label}</p>`,
      },
    ],
    notes: `${label} notes`,
  }
}

function createIdFactory(ids) {
  let index = 0
  return () => {
    const value = ids[index]
    index += 1
    return value
  }
}

describe('slide operation helpers', () => {
  it('duplicates consecutive slides after each original slide in the selected order', () => {
    const slides = [
      createSlide('slide-a', 'A'),
      createSlide('slide-b', 'B'),
      createSlide('slide-c', 'C'),
      createSlide('slide-d', 'D'),
    ]

    const result = duplicateSlidesAtIndices(
      slides,
      [1, 2],
      createIdFactory(['slide-b-copy', 'slide-b-copy-element', 'slide-c-copy', 'slide-c-copy-element'])
    )

    expect(result.slides.map((slide) => slide.id)).toEqual([
      'slide-a',
      'slide-b',
      'slide-b-copy',
      'slide-c',
      'slide-c-copy',
      'slide-d',
    ])
    expect(result.duplicatedIndices).toEqual([2, 4])
    expect(result.slides[2].elements[0].id).toBe('slide-b-copy-element')
    expect(result.slides[4].elements[0].id).toBe('slide-c-copy-element')
  })

  it('deletes a multi-selection and clamps the current index inside the remaining slides', () => {
    const slides = [
      createSlide('slide-a'),
      createSlide('slide-b'),
      createSlide('slide-c'),
      createSlide('slide-d'),
    ]

    const result = deleteSlidesAtIndices(slides, [2, 3], 3)

    expect(result.slides.map((slide) => slide.id)).toEqual(['slide-a', 'slide-b'])
    expect(result.currentSlideIndex).toBe(1)
  })

  it('clamps the current slide index to the valid range', () => {
    expect(clampSlideIndex(4, 2)).toBe(1)
    expect(clampSlideIndex(-1, 2)).toBe(0)
    expect(clampSlideIndex(2, 0)).toBe(0)
  })
})
