import { describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { createDefaultGameConfig } from '../../shared/src/education/game-defaults.js'
import rasterModule from './server-raster.js'

const { getServerRasters } = rasterModule
const question = {
  ...createDefaultGameConfig('quiz').questions[0],
  kind: 'fill-blank',
  prompt: 'Write the authored answer',
  options: undefined,
  answerKey: { accepted: ['TEACHER_ONLY_ANSWER'], caseSensitive: false },
  media: {
    src:
      'data:image/svg+xml;base64,' +
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#00ffff"/></svg>'
      ).toString('base64'),
    alt: 'Authored cyan rectangle',
  },
}
const game = {
  id: 'game-static',
  type: 'game',
  gameType: 'quiz',
  x: 100,
  y: 80,
  width: 600,
  height: 360,
  rotation: 30,
  quiz: { ...createDefaultGameConfig('quiz'), questions: [question] },
}
const presentation = {
  title: 'Static capture',
  resolution: { width: 960, height: 540 },
  slides: [{ id: 'slide', elements: [game] }],
}

async function imagePixels(data) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    return await page.evaluate(async (source) => {
      const image = new Image()
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = source
      })
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let cyan = 0
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] === 0 && pixels[i + 1] === 255 && pixels[i + 2] === 255) cyan++
      return { width: canvas.width, height: canvas.height, cyan }
    }, data)
  } finally {
    await browser.close()
  }
}

describe('real education raster capture', () => {
  it('captures authored media at unrotated bounds and isolates public/teacher cache entries', async () => {
    const cache = new Map()
    const publicRaster = (await getServerRasters(presentation, { cache }))['game-static']
    const teacherRaster = (await getServerRasters(presentation, { cache, teacherReveal: true }))[
      'game-static'
    ]
    const publicPixels = await imagePixels(publicRaster)
    expect(publicPixels.width / publicPixels.height).toBeCloseTo(600 / 360, 2)
    expect(publicPixels.cyan).toBeGreaterThan(500)
    expect(teacherRaster).not.toBe(publicRaster)
    expect(
      (await getServerRasters(presentation, { cache, teacherReveal: 'true' }))['game-static']
    ).toBe(publicRaster)
  }, 60000)

  it('captures each repeated inherited game with its effective bounds and theme instead of missing or cross-wiring it', async () => {
    const inherited = {
      ...presentation,
      layoutMasters: [{ id: 'lesson', name: 'Lesson', fixedElements: [game], placeholders: [] }],
      slides: [
        {
          id: 'first',
          layoutId: 'lesson',
          elements: [],
          children: [
            {
              id: 'child',
              layoutId: 'lesson',
              elements: [],
              layoutOverrides: {
                elementPatches: { 'game-static': { width: 500, backgroundColor: '#00ff00' } },
              },
            },
          ],
        },
      ],
    }
    const rasters = await getServerRasters(inherited)
    const images = Object.values(rasters)
    expect(images).toHaveLength(2)
    expect(images[0]).not.toBe(images[1])
    const first = await imagePixels(images[0]),
      child = await imagePixels(images[1])
    expect(first.width / first.height).toBeCloseTo(600 / 360, 2)
    expect(child.width / child.height).toBeCloseTo(500 / 360, 2)
  }, 60000)

  it('rejects missing authored media instead of claiming a successful native snapshot', async () => {
    const invalid = structuredClone(presentation)
    invalid.slides[0].elements[0].quiz.questions[0].media.src = 'data:image/png;base64,broken'
    await expect(getServerRasters(invalid)).rejects.toThrow(/image|media|capture/i)
  }, 30000)
})
