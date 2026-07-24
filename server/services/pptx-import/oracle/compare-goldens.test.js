import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { encodePngRgba } from './png-rgba.js'
import { compareCorpusToGoldens, compareDeck } from './compare-goldens.js'

const sha = (value) => createHash('sha256').update(value).digest('hex')

function solid(width, height, value) {
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = value; rgba[i + 1] = value; rgba[i + 2] = value; rgba[i + 3] = 255
  }
  return encodePngRgba(width, height, rgba)
}

describe('compare-goldens', () => {
  const dirs = []
  afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))))

  async function root() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'golden-compare-'))
    dirs.push(dir)
    return dir
  }

  async function pair(dir, count = 1) {
    const golden = path.join(dir, 'goldens', 'deck-a')
    const actual = path.join(dir, 'actuals', 'deck-a')
    await fs.mkdir(golden, { recursive: true })
    await fs.mkdir(actual, { recursive: true })
    for (let index = 0; index < count; index += 1) {
      await fs.writeFile(path.join(golden, `slide-${index}.png`), solid(16, 16, index * 20))
      await fs.writeFile(path.join(actual, `slide-${index}.png`), solid(16, 16, index * 20))
    }
    return { golden, actual }
  }

  it('compares every exact actual against every exact golden', async () => {
    const dir = await root()
    await pair(dir, 2)
    const result = await compareDeck({
      deckFile: 'deck-a.pptx', goldensDir: path.join(dir, 'goldens'), actualsDir: path.join(dir, 'actuals'), expectedSlideCount: 2,
    })
    expect(result).toMatchObject({ ok: true, meanSsim: 1, goldenCount: 2, actualCount: 2 })
    expect(result.slides.map((slide) => slide.index)).toEqual([0, 1])
  })

  it.each([
    ['missing actuals', async () => {}, 'missing-actuals'],
    ['gapped actual indexes', async (actual) => { await fs.rename(path.join(actual, 'slide-1.png'), path.join(actual, 'slide-2.png')) }, 'actual-slide-inventory-invalid'],
    ['extra actual image', async (actual) => fs.writeFile(path.join(actual, 'slide-2.png'), solid(16, 16, 1)), 'actual-slide-inventory-invalid'],
    ['wrong source slide count', async () => {}, 'slide-count-mismatch'],
  ])('fails closed for %s', async (_name, mutate, error) => {
    const dir = await root()
    const { actual } = await pair(dir, 2)
    if (error === 'missing-actuals') await fs.rm(actual, { recursive: true })
    else await mutate(actual)
    const expectedSlideCount = _name === 'wrong source slide count' ? 3 : 2
    const result = await compareDeck({
      deckFile: 'deck-a.pptx', goldensDir: path.join(dir, 'goldens'), actualsDir: path.join(dir, 'actuals'), expectedSlideCount,
    })
    expect(result).toMatchObject({ ok: false, error, meanSsim: null })
  })

  it('rejects placeholder goldens and declared image hash drift before SSIM', async () => {
    const dir = await root()
    const { golden, actual } = await pair(dir)
    await fs.writeFile(path.join(golden, 'slide-0.png'), solid(8, 8, 1))
    let result = await compareDeck({
      deckFile: 'deck-a.pptx', goldensDir: path.join(dir, 'goldens'), actualsDir: path.join(dir, 'actuals'), expectedSlideCount: 1,
    })
    expect(result).toMatchObject({ ok: false, error: 'placeholder-goldens' })

    const image = solid(16, 16, 1)
    await fs.writeFile(path.join(golden, 'slide-0.png'), image)
    await fs.writeFile(path.join(actual, 'slide-0.png'), image)
    result = await compareDeck({
      deckFile: 'deck-a.pptx', goldensDir: path.join(dir, 'goldens'), actualsDir: path.join(dir, 'actuals'), expectedSlideCount: 1,
      expectedGoldenSlides: [{ sha256: sha(image), byteLength: image.length }],
      expectedActualSlides: [{ sha256: sha('different'), byteLength: image.length }],
    })
    expect(result).toMatchObject({ ok: false, error: 'actual-image-hash-mismatch' })
  })

  it('fails corpus runs with a missing golden deck rather than skipping it', async () => {
    const dir = await root()
    const corpus = path.join(dir, 'corpus')
    await fs.mkdir(corpus)
    await fs.writeFile(path.join(corpus, 'deck-a.pptx'), 'source')
    const result = await compareCorpusToGoldens({ corpusDir: corpus, goldensDir: path.join(dir, 'goldens'), actualsDir: path.join(dir, 'actuals') })
    expect(result).toMatchObject({ failed: true, missingGoldens: ['deck-a.pptx'], meanSsim: null })
  })
})
