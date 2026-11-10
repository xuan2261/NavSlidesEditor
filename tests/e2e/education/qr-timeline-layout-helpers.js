import { expect, apiCreatePresentation, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
export { waitForAuthoredQrInk, populate }
async function waitForAuthoredQrInk(canvas) {
  await expect
    .poll(() =>
      canvas.evaluate((c) => {
        const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        for (let i = 0; i < pixels.length; i += 4) {
          if (
            pixels[i] === 17 &&
            pixels[i + 1] === 34 &&
            pixels[i + 2] === 51 &&
            pixels[i + 3] === 255
          )
            return true
        }
        return false
      })
    )
    .toBe(true)
}

async function populate(request, title, element) {
  const deck = await apiCreatePresentation(request, title)
  await apiUpdatePresentation(request, deck.id, {
    resolution: { width: 1280, height: 720 },
    slides: [
      {
        id: 'layout',
        background: { type: 'color', color: '#f8fafc' },
        elements: [{ id: 'layout-element', x: 100, y: 140, zIndex: 1, ...element }],
      },
    ],
  })
  return deck
}
