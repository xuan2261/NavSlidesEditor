import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import importer from './importer.js'

const corpusPath = fileURLToPath(new URL('../../data/test-corpus/STTre_Duc.pptx', import.meta.url))
let uploadsDir
let presentation

beforeAll(async () => {
  uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-native-fidelity-'))
  const result = await importer.importPptxFile(corpusPath, {
    originalName: 'STTre_Duc.pptx',
    uploadsDir,
  })
  presentation = result.presentation
}, 30_000)

afterAll(async () => {
  if (uploadsDir) await fs.rm(uploadsDir, { recursive: true, force: true })
})

describe('native PowerPoint layout and text inheritance', () => {
  it('preserves inherited master decoration behind the slide title and body', () => {
    const elements = presentation.slides[17].elements
    const band = elements.find((element) => element.fill === '#41BD5F')
    const frame = elements.find((element) => element.fill === '#1C5E29' && element.shape === 'rounded-rect')
    const title = elements.find((element) => element.name === 'Rectangle 7')
    const body = elements.find((element) => element.name === 'Rectangle 1')
    expect(band).toMatchObject({ type: 'shape', x: 0, width: 960 })
    expect(frame).toMatchObject({ type: 'shape', shape: 'rounded-rect' })
    expect(frame.zIndex).toBeLessThan(title.zIndex)
    expect(band.zIndex).toBeLessThan(body.zIndex)
  })

  it('uses presentation defaults for ordinary shapes without changing explicit run fonts', () => {
    const elements = presentation.slides[17].elements
    const title = elements.find((element) => element.name === 'Rectangle 7')
    const body = elements.find((element) => element.name === 'Rectangle 1')
    expect(body.fontFamily).toBe('Times New Roman')
    expect(title.fontFamily).toBe('Times New Roman')
    expect(body.fontSize).toBe(28)
    expect(title.fontSize).toBe(28)
    expect(presentation.resolution).toEqual({ width: 960, height: 540 })
  })
})
