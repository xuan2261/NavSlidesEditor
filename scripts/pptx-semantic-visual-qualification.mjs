// Extra typed-fixture gate, deliberately independent of the canonical eleven-deck CLI.
// Inputs: feature-corpus/, feature-goldens/ (deck PNG directories only),
// feature-golden-manifest.json, feature-oracle-manifest.json and
// feature-oracle-receipts.json beneath --evidence. The audited envelope's
// visualOracle.featureProfile artifact contains schemaVersion, manifestDigest,
// implementationDigest, qualifierDigest, locale, viewport, deviceScaleFactor, fonts and coverage.
// Fonts are audited artifacts: {alias,family,weight,style,sha256}. Coverage rows
// {fixtureId,id,slide,selector,boxes,text} bind EVERY declared feature and operation
// to positive native DOM boxes (CSS pixels) and exact text; slide is zero based.
// Each fixture.nativeReference binds {goldenManifestDigest}; the audited profile binds this manifest.
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir, readdir, rm, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { inspectFrozenSemanticManifest, manifestDigest, sha256 } from './ci/pptx-semantic-manifest.mjs'
import { implementationDigest } from './ci/pptx-semantic-source-subject.mjs'
import { verifyVisualSummary } from './ci/pptx-semantic-feature-visual.mjs'
const require = createRequire(import.meta.url)
const oracle = (name) => require(`../server/services/pptx-import/oracle/${name}.js`)
const { readEnvelopeArtifacts, validateResultArtifact } = oracle('oracle-evidence-runner')
const { validateVisualEvidenceEnvelope, validateVisualGoldenEnvironment } = oracle('visual-evidence')
const { validateGoldenEvidence, verifyGoldenImageFiles, isSafeRelativePath } = oracle('golden-evidence')
const { verifyGoldenSourceFiles } = oracle('golden-source-evidence')
const { validateActualEvidence, verifyActualSourceFiles, verifyActualImageFiles } = oracle('actual-evidence')
const { capturePackageBackedActuals } = oracle('package-backed-actuals')
const { capturePresentSlides, VIEWPORT } = oracle('capture-present')
const { compareCorpusToGoldens } = oracle('compare-goldens')
const { validateComparisonInventory } = oracle('comparison-evidence')
const { hashCanonical } = require('../server/services/pptx-import/evidence/canonical-hash.js')
const check = (condition, reason) => { if (!condition) throw new Error(reason) }
const valid = (result) => check(result.valid, result.reasons.join(','))
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))

async function containedFile(root, alias) {
  check(isSafeRelativePath(alias), 'unsafe-feature-artifact-path')
  const base = await realpath(root)
  const file = await realpath(path.resolve(base, alias))
  check(file.startsWith(`${base}${path.sep}`), 'feature-artifact-escapes-root')
  return file
}

function validateCoverage(manifest, profile, golden) {
  const expected = [...new Set(manifest.featureFixtures.flatMap((fixture) => [
    ...fixture.features.map((feature) => `${fixture.id}:${feature.id}`),
    ...manifest.operations.filter((operation) => operation.fixtureIds.includes(fixture.id))
      .map((operation) => `${fixture.id}:${operation.id}`),
  ]))]
  const rows = profile.coverage
  check(Array.isArray(rows) && rows.length === expected.length, 'incomplete-typed-feature-coverage')
  check(new Set(rows.map((row) => `${row.fixtureId}:${row.id}`)).size === expected.length, 'duplicate-feature-coverage')
  for (const row of rows) {
    const deck = golden.decks.find((item) => item.source.fileName === `${row.fixtureId}.pptx`)
    check(expected.includes(`${row.fixtureId}:${row.id}`) && deck && Number.isSafeInteger(row.slide) &&
      row.slide >= 0 && row.slide < deck.slides.length, 'unsupported-feature-coverage')
    check(typeof row.selector === 'string' && row.selector && typeof row.text === 'string' &&
      Array.isArray(row.boxes) && row.boxes.length > 0 && row.boxes.every((box) =>
        ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(box[key])) &&
        box.width > 0 && box.height > 0), 'missing-native-object-baselines')
  }
}

export function installCoverageCapture(page, profile, deckStem) {
  const screenshot = page.screenshot.bind(page)
  page.screenshot = async (...args) => {
    await page.waitForFunction(() => window.__navslidesExportReady === true)
    await page.evaluate(({ coverage, fixtureId }) => {
      const slide = window.Reveal.getCurrentSlide()
      const ordinal = window.Reveal.getSlides().indexOf(slide)
      for (const row of coverage.filter((item) => item.fixtureId === fixtureId && item.slide === ordinal)) {
        const nodes = [...slide.querySelectorAll(row.selector)]
        if (nodes.length !== row.boxes.length || nodes.map((node) => node.textContent).join('') !== row.text)
          throw new Error('typed-object-content-mismatch')
        nodes.forEach((node, index) => {
          if (!node.closest('[data-pptx-instance-id],[data-pptx-semantic-mount]') ||
            node.closest('[data-pptx-text-layout="unsupported-preview"],[role="alert"]'))
            throw new Error('nonsemantic-or-unsupported-feature-capture')
          const box = node.getBoundingClientRect(), expected = row.boxes[index]
          if (['x', 'y', 'width', 'height'].some((key) => Math.abs(box[key] - expected[key]) > 0.5))
            throw new Error('typed-object-geometry-mismatch')
        })
      }
    }, { coverage: profile.coverage, fixtureId: deckStem })
    return screenshot(...args)
  }
}

async function captureWithProfile(presentation, options, profile, contents) {
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: true })
  try {
    return await capturePresentSlides(presentation, { ...options, browser: {
      async newPage(settings) {
        const page = await browser.newPage({ ...settings, locale: profile.locale })
        installCoverageCapture(page, profile, options.deckStem)
        const setContent = page.setContent.bind(page)
        page.setContent = async (...args) => {
          await setContent(...args)
          await page.evaluate(async (fonts) => {
            for (const font of fonts) {
              const bytes = Uint8Array.from(atob(font.base64), (char) => char.charCodeAt(0))
              const face = new FontFace(font.family, bytes, { weight: font.weight, style: font.style })
              document.fonts.add(await face.load())
            }
            await document.fonts.ready
          }, profile.fonts.map((font) => ({ ...font, base64: contents[font.alias].toString('base64') })))
          await page.waitForFunction(() => window.__navslidesExportReady === true)
        }
        return page
      },
    } })
  } finally { await browser.close() }
}
export async function readCapturePrerequisites({ root, manifest, evidenceDir, digest }) {
  const corpusDir = path.join(evidenceDir, 'feature-corpus'), goldensDir = path.join(evidenceDir, 'feature-goldens')
  const expected = manifest.featureFixtures.map((fixture) => ({
    id: `${fixture.id}.pptx`, sha256: fixture.sha256, byteLength: fixture.byteLength,
  }))
  const corpusFiles = await readdir(corpusDir)
  const allowedExact = new Set([...expected.map((deck) => deck.id), 'corpus-manifest.json'])
  check(corpusFiles.every((name) => allowedExact.has(name)), 'feature-corpus-inventory-mismatch')
  let corpus = null
  if (corpusFiles.includes('corpus-manifest.json')) {
    const sidecar = await json(await containedFile(corpusDir, 'corpus-manifest.json'))
    check(sidecar && sidecar.schemaVersion === 1, 'invalid-corpus-manifest')
    check(hashCanonical(sidecar.decks) === hashCanonical(expected), 'feature-corpus-manifest-mismatch')
    const { manifestDigest: sidecarDigest, ...sidecarContent } = sidecar
    check(sidecarDigest === hashCanonical(sidecarContent), 'feature-corpus-manifest-mismatch')
    corpus = sidecar
  } else {
    corpus = {
      schemaVersion: 1, decks: expected, manifestDigest: hashCanonical({ schemaVersion: 1, decks: expected }),
    }
  }
  const sourceFiles = corpusFiles.filter((name) => name !== 'corpus-manifest.json').sort()
  check(hashCanonical(sourceFiles) === hashCanonical(expected.map((deck) => deck.id).sort()), 'feature-corpus-inventory-mismatch')
  const golden = await json(await containedFile(evidenceDir, 'feature-golden-manifest.json'))
  const shared = { corpusManifest: corpus, goldenManifest: golden, requiredDeckCount: expected.length, corpusDir, goldensDir }
  valid(validateGoldenEvidence(shared))
  valid(await verifyGoldenSourceFiles(shared))
  valid(await verifyGoldenImageFiles(shared))
  for (const fixture of manifest.featureFixtures) {
    const source = await readFile(await containedFile(corpusDir, `${fixture.id}.pptx`))
    check(sha256(source) === fixture.sha256 && source.length === fixture.byteLength, 'feature-source-mismatch')
    const zip = await require('jszip').loadAsync(source)
    for (const feature of fixture.features) check(feature.sourceParts.every((part) => zip.file(part)), 'missing-feature-source-part')
  }
  let profileBytes = null
  try {
    profileBytes = await readFile(await containedFile(evidenceDir, 'feature-capture-profile.json'))
  } catch {
    try {
      const oracleManifest = await json(await containedFile(evidenceDir, 'feature-oracle-manifest.json'))
      const profileAlias = oracleManifest?.subject?.visualOracle?.featureProfile
      if (profileAlias) profileBytes = await readFile(await containedFile(evidenceDir, profileAlias))
    } catch {
      // missing
    }
  }
  check(profileBytes, 'missing-feature-capture-profile')
  const profile = JSON.parse(profileBytes.toString('utf8'))
  check(profile.schemaVersion === 1 && profile.manifestDigest === manifestDigest(manifest) &&
    profile.implementationDigest === digest, 'stale-feature-profile')
  check(profile.qualifierDigest === sha256(await readFile(new URL(import.meta.url))), 'stale-feature-qualifier')
  check(hashCanonical(profile.viewport) === hashCanonical(VIEWPORT) && profile.deviceScaleFactor === 1 &&
    typeof profile.locale === 'string' && profile.locale, 'unsupported-capture-profile')
  check(golden.captureEnvironment.cropLetterboxPolicyDigest === hashCanonical('reveal-fit-letterbox') &&
    golden.captureEnvironment.resamplingPolicyDigest === hashCanonical('none'), 'unsupported-native-render-policy')
  for (const [key, value] of Object.entries({ viewportDigest: profile.viewport, dpiScaleDigest: 1,
    localeDigest: profile.locale, fontSetDigest: profile.fonts }))
    check(golden.captureEnvironment[key] === hashCanonical(value), `feature-${key}-mismatch`)
  check(Array.isArray(profile.fonts) && profile.fonts.length > 0, 'missing-feature-fonts')
  const fontContents = {}
  for (const font of profile.fonts) {
    let bytes = null
    try {
      bytes = await readFile(await containedFile(evidenceDir, font.alias))
    } catch {
      // missing
    }
    check(bytes && sha256(bytes) === font.sha256 && font.family && font.weight && font.style, 'missing-or-mismatched-font')
    fontContents[font.alias] = bytes
  }
  for (const fixture of manifest.featureFixtures) {
    check(fixture.requiredFonts.every((family) => profile.fonts.some((font) => font.family === family)), 'missing-required-font')
  }
  validateCoverage(manifest, profile, golden)
  return { corpus, golden, profile, profileBytes, fontContents, corpusDir, goldensDir, expected }
}


export async function qualifyFeatureVisual({ root, manifest, evidenceDir, baseUrl = 'http://127.0.0.1:3202', mode = 'qualify' }) {
  check(['qualify', 'capture'].includes(mode), 'invalid-mode')
  if (mode === 'capture') check(baseUrl, 'capture-mode-requires-base-url')
  const digest = await implementationDigest(root)
  valid({ valid: (await inspectFrozenSemanticManifest(root, manifest, path.join(evidenceDir, 'feature-corpus'))).ok, reasons: ['invalid-feature-manifest'] })
  const corpusDir = path.join(evidenceDir, 'feature-corpus'), goldensDir = path.join(evidenceDir, 'feature-goldens')
  const expected = manifest.featureFixtures.map((fixture) => ({ id: `${fixture.id}.pptx`, sha256: fixture.sha256, byteLength: fixture.byteLength }))
  const actualsDir = path.join(evidenceDir, 'feature-actuals')
  if (mode === 'capture') {
    const prereqs = await readCapturePrerequisites({ root, manifest, evidenceDir, digest })
    const { corpus, golden, profile, profileBytes, fontContents } = prereqs
    await mkdir(actualsDir) // Exclusive reservation: never reuse stale actuals or overwrite existing evidence.
    try {
      const actual = { schemaVersion: 1, authority: 'package-backed-http', corpusManifestDigest: corpus.manifestDigest, decks: [] }
      for (const fixture of manifest.featureFixtures) {
        const captured = await capturePackageBackedActuals({ baseUrl, sourcePath: await containedFile(corpusDir, `${fixture.id}.pptx`), outDir: actualsDir,
          capturePresent: (presentation, options) => captureWithProfile(presentation, options, profile, fontContents) })
        check(captured.ok, captured.error || 'feature-capture-failed')
        actual.decks.push(captured.actual)
      }
      await writeFile(path.join(actualsDir, 'actual-manifest.json'), `${JSON.stringify(actual, null, 2)}\n`, 'utf8')
      const actualOptions = { corpusManifest: corpus, actualManifest: actual, corpusDir, actualsDir, requiredDeckCount: expected.length }
      valid(validateActualEvidence(actualOptions)); valid(await verifyActualSourceFiles(actualOptions)); valid(await verifyActualImageFiles(actualOptions))
      const comparison = await compareCorpusToGoldens({ corpusDir, goldensDir, actualsDir, goldenManifest: golden, actualManifest: actual })
      valid(validateComparisonInventory({ comparison, goldenManifest: golden, actualManifest: actual }))
      return { schemaVersion: 1, qualified: false, scope: 'typed-feature-capture-diagnostic', manifestDigest: manifestDigest(manifest),
        implementationDigest: digest, corpus, golden, actual, comparison, profileDigest: sha256(profileBytes),
        thresholds: { meanSsim: 0.99, minSsim: 0.97 }, coverage: profile.coverage }
    } catch (error) { await rm(actualsDir, { recursive: true, force: true }); throw error }
  }
  const loaded = await readEnvelopeArtifacts(path.join(evidenceDir, 'feature-oracle-manifest.json'))
  const receipts = await json(path.join(evidenceDir, 'feature-oracle-receipts.json'))
  valid(validateVisualEvidenceEnvelope({ ...loaded, receipts }))
  const { corpus, golden, actual, result } = loaded.parsed
  valid(validateVisualGoldenEnvironment({ manifest: loaded.manifest, goldenManifest: golden }))
  const visual = loaded.manifest.subject.visualOracle
  const profileBytes = loaded.contents[visual.featureProfile]
  check(profileBytes, 'missing-feature-capture-profile')
  const profile = JSON.parse(profileBytes.toString('utf8'))
  check(profile.schemaVersion === 1 && profile.manifestDigest === manifestDigest(manifest) &&
    profile.implementationDigest === digest, 'stale-feature-profile')
  check(profile.qualifierDigest === sha256(await readFile(new URL(import.meta.url))), 'stale-feature-qualifier')
  check(hashCanonical(profile.viewport) === hashCanonical(VIEWPORT) && profile.deviceScaleFactor === 1 &&
    typeof profile.locale === 'string' && profile.locale, 'unsupported-capture-profile')
  check(visual.environment.capturePolicyDigest === hashCanonical('package-backed-present-960x540-v1') &&
    golden.captureEnvironment.cropLetterboxPolicyDigest === hashCanonical('reveal-fit-letterbox') &&
    golden.captureEnvironment.resamplingPolicyDigest === hashCanonical('none'), 'unsupported-native-render-policy')
  for (const [key, value] of Object.entries({ viewportDigest: profile.viewport, dpiScaleDigest: 1,
    localeDigest: profile.locale, fontSetDigest: profile.fonts }))
    check(golden.captureEnvironment[key] === hashCanonical(value), `feature-${key}-mismatch`)
  check(Array.isArray(profile.fonts) && profile.fonts.length > 0, 'missing-feature-fonts')
  for (const font of profile.fonts) check(loaded.contents[font.alias] &&
    sha256(loaded.contents[font.alias]) === font.sha256 && font.family && font.weight && font.style, 'missing-or-mismatched-font')
  const { manifestDigest: corpusDigest, ...corpusContent } = corpus
  check(hashCanonical(corpus.decks) === hashCanonical(expected) && corpusDigest === hashCanonical(corpusContent), 'feature-source-domain-mismatch')
  for (const fixture of manifest.featureFixtures) {
    check(fixture.nativeReference?.goldenManifestDigest === visual.goldenManifestDigest, 'missing-or-stale-native-reference')
    check(fixture.requiredFonts.every((family) => profile.fonts.some((font) => font.family === family)), 'missing-required-font')
  }
  validateCoverage(manifest, profile, golden)
  const corpusFiles = await readdir(corpusDir)
  const allowedExact = new Set([...expected.map((deck) => deck.id), 'corpus-manifest.json'])
  check(corpusFiles.every((name) => allowedExact.has(name)), 'feature-corpus-inventory-mismatch')
  if (corpusFiles.includes('corpus-manifest.json')) {
    const sidecar = await json(await containedFile(corpusDir, 'corpus-manifest.json'))
    check(sidecar && sidecar.schemaVersion === 1, 'invalid-corpus-manifest')
    check(hashCanonical(sidecar.decks) === hashCanonical(expected), 'feature-corpus-manifest-mismatch')
    const { manifestDigest: sidecarDigest, ...sidecarContent } = sidecar
    check(sidecarDigest === hashCanonical(sidecarContent), 'feature-corpus-manifest-mismatch')
    check(hashCanonical(sidecar) === hashCanonical(corpus), 'feature-corpus-manifest-mismatch')
  }
  const sourceFiles = corpusFiles.filter((name) => name !== 'corpus-manifest.json').sort()
  check(hashCanonical(sourceFiles) === hashCanonical(expected.map((deck) => deck.id).sort()), 'feature-corpus-inventory-mismatch')
  const shared = { corpusManifest: corpus, goldenManifest: golden, requiredDeckCount: expected.length, corpusDir, goldensDir }
  valid(validateGoldenEvidence(shared)); valid(await verifyGoldenSourceFiles(shared)); valid(await verifyGoldenImageFiles(shared))
  for (const fixture of manifest.featureFixtures) {
    const source = await readFile(await containedFile(corpusDir, `${fixture.id}.pptx`))
    check(sha256(source) === fixture.sha256 && source.length === fixture.byteLength, 'feature-source-mismatch')
    const zip = await require('jszip').loadAsync(source)
    for (const feature of fixture.features) check(feature.sourceParts.every((part) => zip.file(part)), 'missing-feature-source-part')
  }
  const actualOptions = { corpusManifest: corpus, actualManifest: actual, corpusDir, actualsDir, requiredDeckCount: expected.length }
  valid(validateActualEvidence(actualOptions)); valid(await verifyActualSourceFiles(actualOptions)); valid(await verifyActualImageFiles(actualOptions))
  check(await implementationDigest(root) === digest, 'implementation-changed-during-qualification')
  const comparison = await compareCorpusToGoldens({ corpusDir, goldensDir, actualsDir, goldenManifest: golden, actualManifest: actual })
  valid(validateComparisonInventory({ comparison, goldenManifest: golden, actualManifest: actual }))
  valid(validateResultArtifact(result, comparison, actual))
  valid(verifyVisualSummary(comparison, expected.length))
  check(comparison.meanSsim >= 0.99 && comparison.minSsim >= 0.97, 'feature-visual-below-fixed-native-gate')
  return { schemaVersion: 1, qualified: true, scope: 'typed-feature-visual-only', manifestDigest: manifestDigest(manifest),
    implementationDigest: digest, corpus, golden, actual, comparison, profileDigest: sha256(profileBytes),
    nativeEvidence: { subjectHash: loaded.manifest.subjectHash, goldenManifestDigest: visual.goldenManifestDigest },
    thresholds: { meanSsim: 0.99, minSsim: 0.97 }, coverage: profile.coverage }
}
async function main(argv) {
  const args = { mode: 'qualify' }
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (key === '--mode' && argv[index + 1]) {
      args.mode = argv[++index]
      check(['qualify', 'capture'].includes(args.mode), 'invalid-mode')
      continue
    }
    check(['--manifest', '--evidence', '--out', '--base-url'].includes(key) && argv[index + 1] && !args[key], 'unknown-or-incomplete-argument')
    args[key] = argv[++index]
  }
  check(args['--manifest'] && args['--evidence'] && args['--out'], 'required: --manifest FILE --evidence DIR --out FILE')
  if (args.mode === 'capture') check(args['--base-url'], 'capture-mode-requires-base-url')
  const root = process.cwd(), evidenceDir = path.resolve(root, args['--evidence'])
  check(!(await readdir(path.dirname(path.resolve(root, args['--out'])))).includes(path.basename(args['--out'])), 'feature-report-already-exists')
  const result = await qualifyFeatureVisual({ root, manifest: await json(path.resolve(root, args['--manifest'])), evidenceDir, baseUrl: args['--base-url'], mode: args.mode })
  await writeFile(path.resolve(root, args['--out']), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ qualified: result.qualified, scope: result.scope, comparison: result.comparison }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error) => { console.error(JSON.stringify({ qualified: false, reason: error.message })); process.exitCode = 1 })
