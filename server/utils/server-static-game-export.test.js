// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import exporter from './server-export.js'
import { createDefaultGameConfig } from '../../shared/src/education/game-defaults.js'

const quiz = createDefaultGameConfig('quiz')
quiz.questions[0] = {
  ...quiz.questions[0],
  kind: 'fill-blank',
  options: undefined,
  prompt: 'Authored server prompt',
  answerKey: { accepted: ['TEACHER_ONLY'], caseSensitive: false },
}
const game = {
  id: 'game',
  type: 'game',
  gameType: 'quiz',
  quiz,
  x: 96,
  y: 54,
  width: 600,
  height: 360,
  rotation: 20,
  action: { kind: 'next' },
}
const deck = {
  title: 'Server authored snapshot',
  resolution: { width: 960, height: 540 },
  slides: [{ id: 'first', elements: [game] }],
}
const imageFile = (zip) =>
  Object.values(zip.files).find(
    (file) => !file.dir && file.name.startsWith('ppt/media/') && file.name.endsWith('.png')
  )

describe('real server static PPTX exports', () => {
  it('exports default and explicit teacher snapshots as real PNGs while preserving rotation and reporting browser limits', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'static-pptx-'))
    try {
      const publicPath = path.join(directory, 'public.pptx'),
        teacherPath = path.join(directory, 'teacher.pptx')
      const result = await exporter.exportToFile(deck, publicPath)
      await exporter.exportToFile(deck, teacherPath, { teacherReveal: true })
      const publicZip = await JSZip.loadAsync(await readFile(publicPath)),
        teacherZip = await JSZip.loadAsync(await readFile(teacherPath))
      const publicPng = await imageFile(publicZip).async('nodebuffer'),
        teacherPng = await imageFile(teacherZip).async('nodebuffer')
      expect(publicPng.readUInt32BE(16) / publicPng.readUInt32BE(20)).toBeCloseTo(600 / 360, 2)
      expect(Buffer.compare(publicPng, teacherPng)).not.toBe(0)
      const xml = await publicZip.file('ppt/slides/slide1.xml').async('string')
      expect(xml).toContain('rot="1200000"')
      expect(
        result.warnings.some(
          (warning) => warning.includes('game') && warning.includes('browser-only')
        )
      ).toBe(true)
      expect(result.warnings.some((warning) => /placeholder/i.test(warning))).toBe(false)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 60000)

  it('does not create an export when authored game capture fails', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'failed-static-pptx-'))
    try {
      const filePath = path.join(directory, 'failed.pptx')
      const invalid = structuredClone(deck)
      invalid.slides[0].elements[0].quiz.questions = []
      await expect(
        exporter.exportToFile(invalid, filePath, { allowFallback: true })
      ).rejects.toThrow()
      await expect(readFile(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
