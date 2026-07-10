import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { encodePngRgba } from './png-rgba.js'
import { compareCorpusToGoldens, compareDeck } from './compare-goldens.js'

function solid(w, h, v) {
  const buf = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    buf[i * 4] = v
    buf[i * 4 + 1] = v
    buf[i * 4 + 2] = v
    buf[i * 4 + 3] = 255
  }
  return buf
}

describe('compare-goldens', () => {
  /** @type {string[]} */
  const temps = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })))
  })

  async function temp() {
    const d = await fs.mkdtemp(path.join(os.tmpdir(), 'goldens-'))
    temps.push(d)
    return d
  }

  it('fails when corpus deck has no goldens', async () => {
    const root = await temp()
    const corpus = path.join(root, 'corpus')
    const goldens = path.join(root, 'goldens')
    await fs.mkdir(corpus)
    await fs.writeFile(path.join(corpus, 'deck-a.pptx'), 'x')
    const result = await compareCorpusToGoldens({ corpusDir: corpus, goldensDir: goldens })
    expect(result.failed).toBe(true)
    expect(result.missingGoldens).toContain('deck-a.pptx')
  })

  it('compares actual vs golden when both present', async () => {
    const root = await temp()
    const goldens = path.join(root, 'goldens', 'deck-a')
    const actuals = path.join(root, 'actuals', 'deck-a')
    await fs.mkdir(goldens, { recursive: true })
    await fs.mkdir(actuals, { recursive: true })
    const g = encodePngRgba(16, 16, solid(16, 16, 0))
    const a = encodePngRgba(16, 16, solid(16, 16, 255))
    await fs.writeFile(path.join(goldens, 'slide-0.png'), g)
    await fs.writeFile(path.join(actuals, 'slide-0.png'), a)
    const deck = await compareDeck({
      deckFile: 'deck-a.pptx',
      goldensDir: path.join(root, 'goldens'),
      actualsDir: path.join(root, 'actuals'),
    })
    expect(deck.ok).toBe(true)
    expect(deck.slides[0].ssim).toBeLessThan(0.2)
  })

  it('fails missing actuals by default', async () => {
    const root = await temp()
    const goldens = path.join(root, 'goldens', 'deck-a')
    await fs.mkdir(goldens, { recursive: true })
    await fs.writeFile(path.join(goldens, 'slide-0.png'), encodePngRgba(16, 16, solid(16, 16, 50)))
    const deck = await compareDeck({
      deckFile: 'deck-a.pptx',
      goldensDir: path.join(root, 'goldens'),
      actualsDir: null,
    })
    expect(deck).toMatchObject({ ok: false, error: 'missing-actuals', meanSsim: null })
  })

  it('self-compares only in explicit debt-record mode', async () => {
    const root = await temp()
    const goldens = path.join(root, 'goldens', 'deck-a')
    await fs.mkdir(goldens, { recursive: true })
    await fs.writeFile(path.join(goldens, 'slide-0.png'), encodePngRgba(16, 16, solid(16, 16, 50)))
    const deck = await compareDeck({
      deckFile: 'deck-a.pptx',
      goldensDir: path.join(root, 'goldens'),
      actualsDir: null,
      debtRecord: true,
    })
    expect(deck.meanSsim).toBe(1)
    expect(deck.slides[0].note).toContain('golden-self')
  })

  it('rejects placeholder 8x8 goldens even in debt-record mode', async () => {
    const root = await temp()
    const goldens = path.join(root, 'goldens', 'deck-a')
    await fs.mkdir(goldens, { recursive: true })
    await fs.writeFile(path.join(goldens, 'slide-0.png'), encodePngRgba(8, 8, solid(8, 8, 50)))
    const deck = await compareDeck({
      deckFile: 'deck-a.pptx',
      goldensDir: path.join(root, 'goldens'),
      debtRecord: true,
    })
    expect(deck).toMatchObject({ ok: false, error: 'placeholder-goldens', meanSsim: null })
  })
})
