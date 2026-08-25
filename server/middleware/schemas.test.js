import { describe, expect, it } from 'vitest'
import schemas from './schemas.js'

const { updatePresentationSchema } = schemas

describe('presentation update schema', () => {
  it('accepts game elements as first-class presentation elements', () => {
    const result = updatePresentationSchema.safeParse({
      slides: [
        {
          elements: [
            {
              type: 'game',
              gameType: 'name-picker',
              x: 160,
              y: 40,
              width: 640,
              height: 480,
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it('accepts bounded layout metadata and rejects dangling bindings or identity patches', () => {
    const layoutMasters = [
      {
        id: 'layout',
        name: 'Layout',
        fixedElements: [{ id: 'band', type: 'shape', x: 0, y: 0, width: 960, height: 20 }],
        placeholders: [
          { id: 'title', type: 'text', role: 'title', x: 80, y: 80, width: 800, height: 100 },
        ],
      },
    ]
    const valid = updatePresentationSchema.safeParse({
      layoutMasters,
      slides: [
        {
          layoutId: 'layout',
          elements: [{ id: 'title-owned', type: 'text', x: 0, y: 0, width: 1, height: 1 }],
          layoutOverrides: {
            placeholderBindings: { title: 'title-owned' },
            elementPatches: { band: { opacity: 0.5 } },
          },
        },
      ],
    })
    const invalid = updatePresentationSchema.safeParse({
      layoutMasters,
      slides: [
        {
          layoutId: 'layout',
          elements: [],
          layoutOverrides: {
            placeholderBindings: { title: 'missing' },
            elementPatches: { band: { id: 'changed' } },
          },
        },
      ],
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })
})
