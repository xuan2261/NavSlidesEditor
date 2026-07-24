import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { encodePngRgba } from './png-rgba.js'
import evidence from './golden-evidence.js'

const { validateGoldenEvidence, verifyGoldenImageFiles } = evidence
const sha = (value) => createHash('sha256').update(value).digest('hex')

function image(width, height, value) {
  const rgba = Buffer.alloc(width * height * 4, value)
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255
  return encodePngRgba(width, height, rgba)
}

function fixture() {
  const sourceHash = sha('source-deck-a')
  const corpusManifest = {
    schemaVersion: 1,
    manifestDigest: sha('corpus-manifest'),
    decks: [{ id: 'deck-a.pptx', sha256: sourceHash }],
  }
  const png0 = image(16, 12, 20)
  const png1 = image(16, 12, 30)
  const goldenManifest = {
    schemaVersion: 1,
    authority: 'Microsoft PowerPoint',
    corpusManifestDigest: corpusManifest.manifestDigest,
    renderer: {
      name: 'Microsoft PowerPoint', officeVersion: '16.0', officeBuild: '16.0.12345',
      officeDigest: sha('office'), windowsDigest: sha('windows'),
    },
    captureEnvironment: {
      fontSetDigest: sha('fonts'), localeDigest: sha('locale'), dpiScaleDigest: sha('dpi'),
      viewportDigest: sha('viewport'), cropLetterboxPolicyDigest: sha('crop'),
      resamplingPolicyDigest: sha('resampling'),
    },
    decks: [{
      source: { fileName: 'deck-a.pptx', sha256: sourceHash, byteLength: 123, ooxmlSlideCount: 2 },
      slides: [
        { index: 0, path: 'deck-a/slide-0.png', sha256: sha(png0), byteLength: png0.length, width: 16, height: 12 },
        { index: 1, path: 'deck-a/slide-1.png', sha256: sha(png1), byteLength: png1.length, width: 16, height: 12 },
      ],
    }],
  }
  return { corpusManifest, goldenManifest, png0, png1 }
}

describe('golden evidence', () => {
  const tempDirs = []
  afterEach(async () => Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))))

  it('accepts only a complete PowerPoint bundle bound to the exact corpus', () => {
    const { corpusManifest, goldenManifest } = fixture()
    expect(validateGoldenEvidence({ corpusManifest, goldenManifest })).toEqual({ valid: true, reasons: [] })
  })

  it.each([
    ['LibreOffice renderer', (manifest) => { manifest.renderer.name = 'LibreOffice' }, 'golden-renderer-not-powerpoint'],
    ['corpus hash drift', (manifest) => { manifest.decks[0].source.sha256 = sha('other') }, 'golden-source-hash-mismatch'],
    ['missing contiguous image', (manifest) => { manifest.decks[0].slides.pop() }, 'golden-slide-inventory-mismatch'],
    ['unsafe image path', (manifest) => { manifest.decks[0].slides[0].path = '../slide-0.png' }, 'unsafe-golden-image-path'],
  ])('rejects %s before visual comparison', (_name, mutate, reason) => {
    const { corpusManifest, goldenManifest } = fixture()
    mutate(goldenManifest)
    expect(validateGoldenEvidence({ corpusManifest, goldenManifest })).toEqual(expect.objectContaining({
      valid: false, reasons: expect.arrayContaining([reason]),
    }))
  })

  it('rejects undeclared PNG files in a golden deck directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'golden-evidence-'))
    tempDirs.push(root)
    const { corpusManifest, goldenManifest, png0, png1 } = fixture()
    await fs.mkdir(path.join(root, 'deck-a'))
    await fs.writeFile(path.join(root, 'deck-a', 'slide-0.png'), png0)
    await fs.writeFile(path.join(root, 'deck-a', 'slide-1.png'), png1)
    await fs.writeFile(path.join(root, 'deck-a', 'slide-2.png'), png1)
    await expect(verifyGoldenImageFiles({ corpusManifest, goldenManifest, goldensDir: root }))
      .resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['golden-image-inventory-mismatch']) }))
  })

  it('checks file hashes before PNG decoding and rejects placeholders', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'golden-evidence-'))
    tempDirs.push(root)
    const { corpusManifest, goldenManifest, png0, png1 } = fixture()
    await fs.mkdir(path.join(root, 'deck-a'))
    await fs.writeFile(path.join(root, 'deck-a', 'slide-0.png'), png0)
    await fs.writeFile(path.join(root, 'deck-a', 'slide-1.png'), png1)

    await expect(verifyGoldenImageFiles({ corpusManifest, goldenManifest, goldensDir: root }))
      .resolves.toEqual({ valid: true, reasons: [] })

    await fs.writeFile(path.join(root, 'deck-a', 'slide-1.png'), Buffer.from('not-a-png'))
    await expect(verifyGoldenImageFiles({ corpusManifest, goldenManifest, goldensDir: root }))
      .resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['golden-image-hash-mismatch']) }))

    const placeholder = image(8, 8, 1)
    goldenManifest.decks[0].slides[1] = {
      ...goldenManifest.decks[0].slides[1], sha256: sha(placeholder), byteLength: placeholder.length, width: 8, height: 8,
    }
    await fs.writeFile(path.join(root, 'deck-a', 'slide-1.png'), placeholder)
    await expect(verifyGoldenImageFiles({ corpusManifest, goldenManifest, goldensDir: root }))
      .resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['placeholder-golden-image']) }))
  })
})
