import { describe, expect, it } from 'vitest'

import { applyTranslatedNotes, normalizePresentationNotes } from './slide-notes'

describe('slide notes normalization', () => {
  it('normalizes legacy speakerNotes into notes', () => {
    const presentation = {
      title: 'Legacy',
      slides: [
        {
          id: 's1',
          speakerNotes: 'Legacy speaker notes',
          elements: [],
        },
      ],
    }

    const normalized = normalizePresentationNotes(presentation)

    expect(normalized.slides[0].notes).toBe('Legacy speaker notes')
    expect(normalized.slides[0].speakerNotes).toBeUndefined()
  })

  it('keeps notes as the canonical field when both notes fields exist', () => {
    const presentation = {
      title: 'Canonical',
      slides: [
        {
          id: 's1',
          notes: 'Canonical notes',
          speakerNotes: 'Legacy notes',
          elements: [],
        },
      ],
    }

    const normalized = normalizePresentationNotes(presentation)

    expect(normalized.slides[0].notes).toBe('Canonical notes')
    expect(normalized.slides[0].speakerNotes).toBeUndefined()
  })

  it('normalizes nested child slides without mutating the original presentation', () => {
    const presentation = {
      title: 'Vertical',
      slides: [
        {
          id: 'parent',
          notes: 'Parent notes',
          elements: [],
          children: [
            {
              id: 'child',
              speakerNotes: 'Child notes',
              elements: [],
            },
          ],
        },
      ],
    }

    const normalized = normalizePresentationNotes(presentation)

    expect(normalized.slides[0].children[0].notes).toBe('Child notes')
    expect(normalized.slides[0].children[0].speakerNotes).toBeUndefined()
    expect(presentation.slides[0].children[0].speakerNotes).toBe('Child notes')
  })

  it('applies translated notes into notes and never recreates speakerNotes', () => {
    const updated = applyTranslatedNotes(
      {
        id: 's1',
        speakerNotes: 'Original notes',
        elements: [],
      },
      'Translated notes',
      true
    )

    expect(updated.notes).toBe('Translated notes\n\n---\nOriginal notes')
    expect(updated.speakerNotes).toBeUndefined()
  })
})
