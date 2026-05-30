const { updatePresentationSchema } = require('./schemas')

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
})
