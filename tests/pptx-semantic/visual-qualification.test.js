// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { installCoverageCapture, qualifyFeatureVisual, readCapturePrerequisites } from '../../scripts/pptx-semantic-visual-qualification.mjs'
import { inspectFrozenSemanticManifest, SEMANTIC_OPERATION_IDS, manifestDigest, sha256 } from '../../scripts/ci/pptx-semantic-manifest.mjs'

vi.mock('./feature-fixtures.js', () => { throw new Error('frozen-admission-loaded-feature-builder') })
vi.mock('./geometry-fixtures.js', () => { throw new Error('frozen-admission-loaded-geometry-builder') })

const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const { hashCanonical } = require('../../server/services/pptx-import/evidence/canonical-hash.js')
const { encodePngRgba } = require('../../server/services/pptx-import/oracle/png-rgba.js')
const tempRoots = []

// Independent admission-only package: no corpus, golden or frozen fixture builder is run.
async function admissionFixture({ dimensionsEmu, sourceParts } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'navslides-visual-admission-'))
  tempRoots.push(root)
  const evidenceDir = path.join(root, 'evidence')
  const corpusDir = path.join(evidenceDir, 'feature-corpus')
  const goldensDir = path.join(evidenceDir, 'feature-goldens')
  const canonicalDir = path.join(root, 'server/data/test-corpus')
  await mkdir(corpusDir, { recursive: true })
  await mkdir(path.join(goldensDir, 'typed'), { recursive: true })
  await mkdir(canonicalDir, { recursive: true })
  await mkdir(path.join(root, 'tests/pptx-semantic'), { recursive: true })
  const zip = new JSZip()
  const parts = {
    'ppt/presentation.xml': '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slides/slide1.xml': '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sld>',
  }
  for (const [name, text] of Object.entries(parts))
    zip.file(name, text, { date: new Date('2000-01-01T00:00:00Z'), createFolders: false })
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const size = { width: 9144000, height: 5143500 }
  const source = { sha256: sha256(bytes), byteLength: bytes.length }
  const manifest = {
    schemaVersion: 1, scope: 'navslides-semantic-editing',
    visualPolicy: { id: 'phase08_full', meanSsim: 0.99, minSsim: 0.97, renderer: 'Microsoft PowerPoint' },
    corpus: [{ id: 'canonical.pptx', path: 'server/data/test-corpus/canonical.pptx', ...source, slideSizeEmu: size }],
    operations: SEMANTIC_OPERATION_IDS.map((id) => ({ id, family: id.split('.')[0], fixtureIds: ['typed'] })),
    featureFixtures: [{ id: 'typed', builder: 'admission-only', ...source,
      dimensionsEmu: dimensionsEmu || size, requiredFonts: ['Admission Font'],
      features: [{ id: 'mixed-text', sourceParts: sourceParts || ['ppt/slides/slide1.xml'] }] }],
  }
  for (const directory of ['client/src', 'client/public', 'server/services', 'server/routes', 'shared/src', 'scripts/ci', 'config'])
    await mkdir(path.join(root, directory), { recursive: true })
  for (const file of ['package.json', 'package-lock.json', 'runtime-versions.json', 'client/vite.config.js', 'server/middleware/schemas.js']) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), '{}')
  }
  const save = (file, value) => writeFile(file, JSON.stringify(value))
  const sourcePath = path.join(corpusDir, 'typed.pptx')
  await writeFile(sourcePath, bytes)
  await writeFile(path.join(canonicalDir, 'canonical.pptx'), bytes)
  await save(path.join(canonicalDir, 'importer-qualification-manifest.json'), { decks: [{ id: 'canonical.pptx', ...source }] })
  await save(path.join(root, 'tests/pptx-semantic/manifest.json'), manifest)
  const decks = [{ id: 'typed.pptx', ...source }]
  const corpus = { schemaVersion: 1, decks, manifestDigest: hashCanonical({ schemaVersion: 1, decks }) }
  const fontBytes = Buffer.from('admission-only-font-bytes')
  const profile = {
    schemaVersion: 1, manifestDigest: manifestDigest(manifest), implementationDigest: 'isolated-implementation',
    qualifierDigest: sha256(await readFile(path.resolve(process.cwd(), 'scripts/pptx-semantic-visual-qualification.mjs'))),
    viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, locale: 'en-US',
    fonts: [{ alias: 'font.bin', family: 'Admission Font', weight: '400', style: 'normal', sha256: sha256(fontBytes) }],
    coverage: ['mixed-text', ...SEMANTIC_OPERATION_IDS].map((id) => ({
      fixtureId: 'typed', id, slide: 0, selector: '.native-run', boxes: [{ x: 12, y: 18, width: 80, height: 24 }], text: 'Native',
    })),
  }
  const png = encodePngRgba(16, 16, Buffer.alloc(16 * 16 * 4, 255))
  const golden = {
    schemaVersion: 1, authority: 'Microsoft PowerPoint',
    renderer: { name: 'Microsoft PowerPoint', officeVersion: 'test', officeBuild: 'test', officeDigest: sha256('office'), windowsDigest: sha256('windows') },
    corpusManifestDigest: corpus.manifestDigest,
    captureEnvironment: Object.fromEntries(Object.entries({ fontSetDigest: profile.fonts, localeDigest: profile.locale,
      dpiScaleDigest: 1, viewportDigest: profile.viewport, cropLetterboxPolicyDigest: 'reveal-fit-letterbox', resamplingPolicyDigest: 'none',
    }).map(([key, value]) => [key, hashCanonical(value)])),
    decks: [{ source: { fileName: 'typed.pptx', ...source, ooxmlSlideCount: 1 },
      slides: [{ index: 0, path: 'typed/slide-0.png', sha256: sha256(png), byteLength: png.length, width: 16, height: 16 }] }],
  }
  const goldenPath = path.join(evidenceDir, 'feature-golden-manifest.json')
  const profilePath = path.join(evidenceDir, 'feature-capture-profile.json')
  await save(goldenPath, golden)
  await save(profilePath, profile)
  await writeFile(path.join(evidenceDir, 'font.bin'), fontBytes)
  await writeFile(path.join(goldensDir, 'typed/slide-0.png'), png)
  return { root, manifest, evidenceDir, corpusDir, goldensDir, sourcePath, bytes, corpus, golden, profile,
    goldenPath, profilePath, save, digest: profile.implementationDigest }
}
const box = { x: 12, y: 18, width: 80, height: 24 }
const row = { fixtureId: 'typed', id: 'mixed-text', slide: 1, selector: '.native-run', boxes: [box], text: 'Native' }

function capturePage() {
  const page = {
    evaluate: vi.fn(async (callback, argument) => callback(argument)),
    waitForFunction: vi.fn(async (callback) => {
      if (!callback()) throw new Error('export-not-ready')
    }),
    screenshot: vi.fn(async () => 'captured'),
  }
  page.capture = page.screenshot
  installCoverageCapture(page, { coverage: [row] }, 'typed')
  return page
}

function currentSlide() {
  document.body.innerHTML = '<section class="present"><section class="present" id="leaf"><div data-pptx-instance-id="one"><span class="native-run">Native</span></div></section></section>'
  const slide = document.getElementById('leaf')
  const node = slide.querySelector('.native-run')
  node.getBoundingClientRect = () => box
  window.Reveal = { getCurrentSlide: () => slide, getSlides: () => [document.createElement('section'), slide] }
  window.__navslidesExportReady = true
  return node
}

afterEach(async () => {
  vi.restoreAllMocks()
  delete window.Reveal
  delete window.__navslidesExportReady
  document.body.replaceChildren()
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('typed oracle screenshot coverage', () => {
  it('checks the settled current Reveal leaf immediately before its screenshot without matching a vertical parent twice', async () => {
    currentSlide()
    const page = capturePage()
    await expect(page.screenshot({ path: 'slide-1.png' })).resolves.toBe('captured')
    expect(page.waitForFunction).toHaveBeenCalledOnce()
    expect(page.evaluate).toHaveBeenCalledOnce()
    expect(page.capture).toHaveBeenCalledOnce()
  })

  it('does not validate during navigation, while geometry can still be unsettled', () => {
    currentSlide()
    const page = capturePage()
    expect(page.evaluate).not.toHaveBeenCalled()
  })

  it.each([
    ['content', (node) => { node.textContent = 'Changed' }, 'typed-object-content-mismatch'],
    ['geometry', (node) => { node.getBoundingClientRect = () => ({ ...box, x: box.x + 1 }) }, 'typed-object-geometry-mismatch'],
    ['preview', (node) => { node.parentElement.dataset.pptxTextLayout = 'unsupported-preview' }, 'nonsemantic-or-unsupported-feature-capture'],
    ['unbound', (node) => { node.parentElement.removeAttribute('data-pptx-instance-id') }, 'nonsemantic-or-unsupported-feature-capture'],
  ])('rejects %s mismatch before taking a screenshot', async (_name, mutate, reason) => {
    mutate(currentSlide())
    const page = capturePage()
    await expect(page.screenshot({ path: 'slide-1.png' })).rejects.toThrow(reason)
    expect(page.capture).not.toHaveBeenCalled()
  })

  it('waits for canonical export readiness again after slide navigation', async () => {
    currentSlide()
    window.__navslidesExportReady = false
    const page = capturePage()
    await expect(page.screenshot({ path: 'slide-1.png' })).rejects.toThrow('export-not-ready')
    expect(page.evaluate).not.toHaveBeenCalled()
    expect(page.capture).not.toHaveBeenCalled()
  })
})

describe('typed visual qualification mode contract', () => {
  it('rejects capture without a base URL before reading source or evidence', async () => {
    await expect(qualifyFeatureVisual({ root: 'absent', evidenceDir: 'absent', baseUrl: '', mode: 'capture' }))
      .rejects.toThrow('capture-mode-requires-base-url')
  })

  it('rejects unknown API modes instead of silently treating them as qualify', async () => {
    await expect(qualifyFeatureVisual({ root: 'absent', evidenceDir: 'absent', mode: 'unapproved' }))
      .rejects.toThrow('invalid-mode')
  })

  it('defaults to hermetic qualification and rejects missing audited evidence', async () => {
    const fixture = await admissionFixture()
    await expect(qualifyFeatureVisual(fixture)).rejects.toThrow('invalid-evidence-manifest-json')
  })
})

describe('frozen semantic manifest inspection contract', () => {
  it('accepts independent pinned bytes without loading or executing fixture builders', async () => {
    const fixture = await admissionFixture()
    const result = await inspectFrozenSemanticManifest(fixture.root, fixture.manifest, fixture.corpusDir)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it.each(['missing', 'tampered'])('rejects %s frozen source bytes', async (kind) => {
    const fixture = await admissionFixture()
    if (kind === 'missing') await rm(fixture.sourcePath)
    else await writeFile(fixture.sourcePath, Buffer.from('tampered-source'))
    const result = await inspectFrozenSemanticManifest(fixture.root, fixture.manifest, fixture.corpusDir)
    expect(result.errors).toEqual([kind === 'missing' ? 'missing-frozen-feature-source' : 'feature-source-mismatch'])
    expect(result.ok).toBe(false)
  })

  it('rejects a caller changing the pinned source digest', async () => {
    const fixture = await admissionFixture()
    fixture.manifest.featureFixtures[0].sha256 = '0'.repeat(64)
    const result = await inspectFrozenSemanticManifest(fixture.root, fixture.manifest, fixture.corpusDir)
    expect(result.errors).toEqual(['feature-source-mismatch'])
  })

  it('checks actual OOXML dimensions even when hashes match the pinned bytes', async () => {
    const fixture = await admissionFixture({ dimensionsEmu: { width: 123456, height: 654321 } })
    const result = await inspectFrozenSemanticManifest(fixture.root, fixture.manifest, fixture.corpusDir)
    expect(result.errors).toEqual(['feature-dimensions-mismatch'])
  })

  it('checks declared source parts even when hashes match the pinned bytes', async () => {
    const fixture = await admissionFixture({ sourceParts: ['ppt/slides/absent.xml'] })
    const result = await inspectFrozenSemanticManifest(fixture.root, fixture.manifest, fixture.corpusDir)
    expect(result.errors).toEqual(['missing-feature-source-part'])
  })

  it('rejects a caller removing pinned source-part requirements', async () => {
    const fixture = await admissionFixture()
    fixture.manifest.featureFixtures[0].features[0].sourceParts = []
    const result = await inspectFrozenSemanticManifest(fixture.root, fixture.manifest, fixture.corpusDir)
    expect(result.errors).toEqual(['feature-source-mismatch'])
  })
})

describe('readCapturePrerequisites contract', () => {
  it('admits isolated source, image, profile and font prerequisites without receipts or builders', async () => {
    const fixture = await admissionFixture()
    const result = await readCapturePrerequisites(fixture)
    expect(result.corpus).toEqual(fixture.corpus)
    expect(result.golden).toEqual(fixture.golden)
    expect(result.profile).toEqual(fixture.profile)
    expect(result.fontContents['font.bin']).toEqual(Buffer.from('admission-only-font-bytes'))
    expect(result).not.toHaveProperty('qualified', true)
  })

  it.each([
    ['extra corpus file', 'corpusDir', 'unexpected.txt', 'feature-corpus-inventory-mismatch'],
    ['extra golden directory', 'goldensDir', 'unexpected.txt', 'golden-image-inventory-mismatch'],
    ['extra golden image', 'goldensDir', 'typed/slide-1.png', 'golden-image-inventory-mismatch'],
    ['old embedded golden manifest', 'goldensDir', 'golden-manifest.json', 'golden-image-inventory-mismatch'],
  ])('rejects %s at the exact inventory boundary', async (_name, directory, file, reason) => {
    const fixture = await admissionFixture()
    await writeFile(path.join(fixture[directory], file), 'unexpected')
    await expect(readCapturePrerequisites(fixture)).rejects.toThrow(reason)
  })

  it('accepts a matching corpus sidecar and rejects a changed sidecar digest', async () => {
    const fixture = await admissionFixture()
    const sidecarPath = path.join(fixture.corpusDir, 'corpus-manifest.json')
    await fixture.save(sidecarPath, fixture.corpus)
    await expect(readCapturePrerequisites(fixture)).resolves.toHaveProperty('corpus', fixture.corpus)
    await fixture.save(sidecarPath, { ...fixture.corpus, manifestDigest: '0'.repeat(64) })
    await expect(readCapturePrerequisites(fixture)).rejects.toThrow('feature-corpus-manifest-mismatch')
  })

  it.each([
    ['profile', 'profilePath', 'missing-feature-capture-profile'],
    ['font', null, 'missing-or-mismatched-font'],
  ])('rejects missing %s prerequisites', async (_name, key, reason) => {
    const fixture = await admissionFixture()
    await rm(key ? fixture[key] : path.join(fixture.evidenceDir, 'font.bin'))
    await expect(readCapturePrerequisites(fixture)).rejects.toThrow(reason)
  })

  it.each([
    ['source', (fixture) => fixture.sourcePath, 'golden-source-file-hash-mismatch'],
    ['image', (fixture) => path.join(fixture.goldensDir, 'typed/slide-0.png'), 'golden-image-hash-mismatch'],
    ['font', (fixture) => path.join(fixture.evidenceDir, 'font.bin'), 'missing-or-mismatched-font'],
  ])('rejects tampered %s prerequisites', async (_name, file, reason) => {
    const fixture = await admissionFixture()
    await writeFile(file(fixture), 'tampered')
    await expect(readCapturePrerequisites(fixture)).rejects.toThrow(reason)
  })

  it.each([
    ['implementation digest', (profile) => { profile.implementationDigest = 'stale' }, 'stale-feature-profile'],
    ['manifest digest', (profile) => { profile.manifestDigest = '0'.repeat(64) }, 'stale-feature-profile'],
    ['qualifier digest', (profile) => { profile.qualifierDigest = '0'.repeat(64) }, 'stale-feature-qualifier'],
    ['scale', (profile) => { profile.deviceScaleFactor = 2 }, 'unsupported-capture-profile'],
    ['coverage', (profile) => { profile.coverage.pop() }, 'incomplete-typed-feature-coverage'],
  ])('rejects stale or incomplete %s prerequisites', async (_name, mutate, reason) => {
    const fixture = await admissionFixture()
    mutate(fixture.profile)
    await fixture.save(fixture.profilePath, fixture.profile)
    await expect(readCapturePrerequisites(fixture)).rejects.toThrow(reason)
  })
})
