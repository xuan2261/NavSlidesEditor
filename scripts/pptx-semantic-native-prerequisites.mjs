// Read-only prerequisite inventory: never opens Office, executes fixture builders,
// captures slides, writes evidence, mints receipts or grants qualification.
// Usage: node scripts/pptx-semantic-native-prerequisites.mjs [--evidence DIR] [--canonical-goldens DIR]
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))

async function identity(file, expected = null) {
  try {
    const bytes = await readFile(file)
    const result = { path: file, present: true, byteLength: bytes.length, sha256: sha256(bytes) }
    if (expected) result.matches = result.sha256 === expected.sha256 &&
      (expected.byteLength === undefined || result.byteLength === expected.byteLength)
    return result
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { path: file, present: false }
    throw error
  }
}

async function exists(file) {
  try { await stat(file); return true } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false
    throw error
  }
}

async function main(argv) {
  const options = {
    '--evidence': '.omo/evidence/pptx-semantic/oct30-task22-native-discovery-f7b2a91c',
    '--canonical-goldens': 'C:/Work/NavSlidesEvidence/powerpoint-goldens-20261011-1d05c4c3',
  }
  const seen = new Set()
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (!Object.hasOwn(options, key) || seen.has(key) || !argv[index + 1] || argv[index + 1].startsWith('--'))
      throw new Error('usage: [--evidence DIR] [--canonical-goldens DIR]')
    seen.add(key)
    options[key] = argv[++index]
  }
  const evidence = options['--evidence'], nativeRoot = '.omo/evidence/pptx-semantic'
  const semantic = await readJson('tests/pptx-semantic/manifest.json')
  const canonicalPath = 'server/data/test-corpus/importer-qualification-manifest.json'
  const canonical = await readJson(canonicalPath)
  const corpus = await Promise.all(canonical.decks.map((deck) => identity(`server/data/test-corpus/${deck.id}`, deck)))
  const features = await Promise.all(semantic.featureFixtures.map(async (fixture) => ({
    id: fixture.id,
    source: await identity(path.join(evidence, 'feature-corpus', `${fixture.id}.pptx`), fixture),
    nativeReference: fixture.nativeReference,
    requiredFonts: fixture.requiredFonts,
  })))
  const goldenFile = path.join(evidence, 'feature-golden-manifest.json')
  let typedGoldens = { manifest: await identity(goldenFile) }
  if (typedGoldens.manifest.present) {
    const golden = await readJson(goldenFile)
    typedGoldens = { ...typedGoldens, renderer: golden.renderer, captureEnvironment: golden.captureEnvironment,
      sources: await Promise.all(golden.decks.map((deck) => identity(
        path.join(evidence, 'feature-corpus', deck.source.fileName), deck.source))),
      images: await Promise.all(golden.decks.flatMap((deck) => deck.slides.map((slide) =>
        identity(path.join(evidence, 'feature-goldens', slide.path), slide)))) }
  }
  const fonts = await Promise.all(['arial.ttf', 'arialbd.ttf', 'msjhbd.ttc', 'calibri.ttf', 'calibrib.ttf']
    .map((file) => identity(`C:/Windows/Fonts/${file}`)))
  const retained = await Promise.all([
    'oct27-native-oracle-prerequisites.json',
    'oct28-native-text-physical-glyph-derivation.json',
    'oct28-native-text-embedded-face-discriminator.json',
  ].map((file) => identity(path.join(nativeRoot, file))))
  const textCaptures = []
  for (const directory of ['native-text-table-shapes-media-oct27', 'native-text-sttre-duc-oct27']) {
    const base = path.join(nativeRoot, directory), capture = await readJson(path.join(base, 'native-capture.json'))
    textCaptures.push({ directory, nativeQualified: capture.nativeQualified, source: capture.source,
      artifacts: await Promise.all([
        identity(path.join(base, 'native-text.pdf'), { sha256: capture.pdf.sha256 }),
        identity(path.join(base, 'native-text-ranges.json'), { sha256: capture.ranges.sha256 }),
        identity(path.join(base, 'native-text-origins.json')),
      ]) })
  }
  const derivation = await readJson(path.join(nativeRoot, 'oct28-native-text-physical-glyph-derivation.json'))
  const admissionFiles = {}
  for (const file of ['feature-oracle-manifest.json', 'feature-oracle-receipts.json', 'feature-capture-profile.json'])
    admissionFiles[file] = await identity(path.join(evidence, file))
  console.log(JSON.stringify({ schemaVersion: 1, scope: 'read-only-native-prerequisites', qualified: false,
    observedAt: new Date().toISOString(), powerPoint: await identity('C:/Program Files/Microsoft Office/root/Office16/POWERPNT.EXE'),
    fonts, retained, canonical: { manifest: await identity(canonicalPath), manifestDigest: canonical.manifestDigest,
      deckCount: corpus.length, sources: corpus,
      goldenRoot: options['--canonical-goldens'], goldenRootPresent: await exists(options['--canonical-goldens']),
      goldenManifest: await identity(path.join(options['--canonical-goldens'], 'golden-manifest.json')) },
    features, typedGoldens, admissionFiles, textCaptures,
    textQualification: { nativeQualified: derivation.nativeQualified,
      uniqueBindings: derivation.boundedUniqueSourceBindings.length,
      traceCrosscheck: derivation.independentTraceCrosscheck, remainingPrerequisites: derivation.remainingPrerequisites },
    limitations: ['Byte identity is not renderer/font-face selection provenance.',
      'Typed golden hashes do not prove source-to-native occurrence correspondence or capture policy.',
      'The feature-capture-profile.json filename is a conventional prerequisite probe; qualification uses the audited featureProfile alias.',
      'No fixture builders, native captures, acceptance gates or tests were executed.'] }, null, 2))
}

main(process.argv.slice(2)).catch((error) => {
  console.error(JSON.stringify({ qualified: false, scope: 'read-only-native-prerequisites', reason: error.message }))
  process.exitCode = 1
})
