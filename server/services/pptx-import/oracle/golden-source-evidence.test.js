import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import sourceEvidence from './golden-source-evidence.js'

const { verifyGoldenSourceFiles } = sourceEvidence
const sha = (value) => createHash('sha256').update(value).digest('hex')

function manifests(bytes) {
  const sourceHash = sha(bytes)
  const corpusManifest = { manifestDigest: sha('corpus'), decks: [{ id: 'deck-a.pptx', sha256: sourceHash }] }
  const goldenManifest = {
    schemaVersion: 1, authority: 'Microsoft PowerPoint', corpusManifestDigest: corpusManifest.manifestDigest,
    renderer: { name: 'Microsoft PowerPoint', officeVersion: '16.0', officeBuild: '16.0.1', officeDigest: sha('office'), windowsDigest: sha('windows') },
    captureEnvironment: {
      fontSetDigest: sha('fonts'), localeDigest: sha('locale'), dpiScaleDigest: sha('dpi'), viewportDigest: sha('viewport'),
      cropLetterboxPolicyDigest: sha('crop'), resamplingPolicyDigest: sha('resampling'),
    },
    decks: [{ source: { fileName: 'deck-a.pptx', sha256: sourceHash, byteLength: bytes.length, ooxmlSlideCount: 2 }, slides: [
      { index: 0, path: 'deck-a/slide-0.png', sha256: sha('png0'), byteLength: 1, width: 16, height: 16 },
      { index: 1, path: 'deck-a/slide-1.png', sha256: sha('png1'), byteLength: 1, width: 16, height: 16 },
    ] }],
  }
  return { corpusManifest, goldenManifest }
}

describe('golden source evidence', () => {
  const dirs = []
  afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))))

  it('binds source bytes and OOXML slide-list count before comparison', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'golden-sources-'))
    dirs.push(root)
    const bytes = Buffer.from('pptx-source')
    const { corpusManifest, goldenManifest } = manifests(bytes)
    await fs.writeFile(path.join(root, 'deck-a.pptx'), bytes)

    await expect(verifyGoldenSourceFiles({
      corpusManifest, goldenManifest, corpusDir: root, inspectSource: async () => ({ slides: [{}, {}] }),
    })).resolves.toEqual({ valid: true, reasons: [] })
  })

  it.each([
    ['source byte drift', async (root) => fs.writeFile(path.join(root, 'deck-a.pptx'), 'other'), 'golden-source-file-hash-mismatch'],
    ['source slide-count drift', async () => {}, 'golden-source-slide-count-mismatch'],
    ['extra corpus deck', async (root) => fs.writeFile(path.join(root, 'extra.pptx'), 'x'), 'extra-corpus-deck'],
  ])('rejects %s before visual comparison', async (_name, mutate, reason) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'golden-sources-'))
    dirs.push(root)
    const bytes = Buffer.from('pptx-source')
    const { corpusManifest, goldenManifest } = manifests(bytes)
    await fs.writeFile(path.join(root, 'deck-a.pptx'), bytes)
    await mutate(root)
    const slideCount = reason === 'golden-source-slide-count-mismatch' ? 1 : 2

    await expect(verifyGoldenSourceFiles({
      corpusManifest, goldenManifest, corpusDir: root, inspectSource: async () => ({ slides: Array(slideCount).fill({}) }),
    })).resolves.toEqual(expect.objectContaining({ valid: false, reasons: expect.arrayContaining([reason]) }))
  })
})
