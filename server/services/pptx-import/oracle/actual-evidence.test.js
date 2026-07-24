import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { encodePngRgba } from './png-rgba.js'
import actualEvidence from './actual-evidence.js'

const { validateActualEvidence, verifyActualImageFiles, verifyActualSourceFiles } = actualEvidence
const sha = (value) => createHash('sha256').update(value).digest('hex')

function png() {
  const rgba = Buffer.alloc(16 * 12 * 4, 255)
  return encodePngRgba(16, 12, rgba)
}

function fixture() {
  const sourceHash = sha('source-a')
  const image = png()
  const corpusManifest = { manifestDigest: sha('corpus'), decks: [{ id: 'deck-a.pptx', sha256: sourceHash }] }
  const actualManifest = {
    schemaVersion: 1, authority: 'package-backed-http', corpusManifestDigest: corpusManifest.manifestDigest,
    decks: [{
      authority: 'package-backed-http', jobId: 'job-1',
      source: { fileName: 'deck-a.pptx', sha256: sourceHash, byteLength: 42, ooxmlSlideCount: 1 },
      presentation: {
        id: 'deck-1', packageRevisionId: 'r0', packageHeadHash: sha('head'), aggregateGeneration: 1,
        originalSha256: sourceHash, originalByteLength: 42,
      },
      slides: [{ index: 0, path: 'deck-a/slide-0.png', sha256: sha(image), byteLength: image.length, width: 16, height: 12 }],
    }],
  }
  return { corpusManifest, actualManifest, image }
}

describe('package-backed actual evidence', () => {
  const dirs = []
  afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))))

  it('requires a package-backed record for every exact corpus source', () => {
    const { corpusManifest, actualManifest } = fixture()
    expect(validateActualEvidence({ corpusManifest, actualManifest })).toEqual({ valid: true, reasons: [] })
  })

  it('checks actual source byte length and OOXML slide count against the corpus file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-evidence-'))
    dirs.push(root)
    const { corpusManifest, actualManifest } = fixture()
    const source = Buffer.from('source-a')
    actualManifest.decks[0].source.byteLength = source.length
    actualManifest.decks[0].presentation.originalByteLength = source.length
    await fs.writeFile(path.join(root, 'deck-a.pptx'), source)
    const options = { corpusManifest, actualManifest, corpusDir: root, inspectSource: async () => ({ slides: [{}] }) }
    await expect(verifyActualSourceFiles(options)).resolves.toEqual({ valid: true, reasons: [] })

    actualManifest.decks[0].source.byteLength += 1
    actualManifest.decks[0].presentation.originalByteLength += 1
    await expect(verifyActualSourceFiles(options)).resolves.toEqual(expect.objectContaining({
      valid: false, reasons: expect.arrayContaining(['actual-source-byte-length-mismatch']),
    }))
  })

  it.each([
    ['direct importer output', (manifest) => { manifest.decks[0].authority = 'direct-import' }, 'actual-not-package-backed-http'],
    ['missing package head', (manifest) => { delete manifest.decks[0].presentation.packageHeadHash }, 'invalid-actual-package-identity'],
    ['source drift', (manifest) => { manifest.decks[0].source.sha256 = sha('other') }, 'actual-source-hash-mismatch'],
    ['wrong R0 byte length', (manifest) => { manifest.decks[0].presentation.originalByteLength += 1 }, 'actual-original-byte-length-mismatch'],
    ['wrong slide inventory', (manifest) => { manifest.decks[0].slides.push({ ...manifest.decks[0].slides[0], index: 1, path: 'deck-a/slide-1.png' }) }, 'actual-slide-inventory-mismatch'],
  ])('rejects %s before SSIM', (_name, mutate, reason) => {
    const { corpusManifest, actualManifest } = fixture()
    mutate(actualManifest)
    expect(validateActualEvidence({ corpusManifest, actualManifest })).toEqual(expect.objectContaining({
      valid: false, reasons: expect.arrayContaining([reason]),
    }))
  })

  it('rejects undeclared actual PNG files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-evidence-'))
    dirs.push(root)
    const { corpusManifest, actualManifest, image } = fixture()
    await fs.mkdir(path.join(root, 'deck-a'))
    await fs.writeFile(path.join(root, 'deck-a', 'slide-0.png'), image)
    await fs.writeFile(path.join(root, 'deck-a', 'slide-1.png'), image)
    await expect(verifyActualImageFiles({ corpusManifest, actualManifest, actualsDir: root }))
      .resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['actual-image-inventory-mismatch']) }))
  })

  it('allows the atomic run manifest beside exact deck directories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-evidence-'))
    dirs.push(root)
    const { corpusManifest, actualManifest, image } = fixture()
    await fs.mkdir(path.join(root, 'deck-a'))
    await fs.writeFile(path.join(root, 'deck-a', 'slide-0.png'), image)
    await fs.writeFile(path.join(root, 'actual-manifest.json'), JSON.stringify(actualManifest))

    await expect(verifyActualImageFiles({ corpusManifest, actualManifest, actualsDir: root }))
      .resolves.toEqual({ valid: true, reasons: [] })
  })

  it('checks actual PNG hashes before decode', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-evidence-'))
    dirs.push(root)
    const { corpusManifest, actualManifest, image } = fixture()
    await fs.mkdir(path.join(root, 'deck-a'))
    await fs.writeFile(path.join(root, 'deck-a', 'slide-0.png'), image)
    await expect(verifyActualImageFiles({ corpusManifest, actualManifest, actualsDir: root }))
      .resolves.toEqual({ valid: true, reasons: [] })
    await fs.writeFile(path.join(root, 'deck-a', 'slide-0.png'), 'tampered')
    await expect(verifyActualImageFiles({ corpusManifest, actualManifest, actualsDir: root }))
      .resolves.toEqual(expect.objectContaining({ reasons: expect.arrayContaining(['actual-image-hash-mismatch']) }))
  })
})
