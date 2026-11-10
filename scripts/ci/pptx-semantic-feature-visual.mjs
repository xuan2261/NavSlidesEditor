import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { manifestDigest } from './pptx-semantic-manifest.mjs'
import { implementationDigest } from './pptx-semantic-source-subject.mjs'

const require = createRequire(import.meta.url)
const {
  validateGoldenEvidence,
  verifyGoldenImageFiles,
} = require('../../server/services/pptx-import/oracle/golden-evidence.js')
const {
  verifyGoldenSourceFiles,
} = require('../../server/services/pptx-import/oracle/golden-source-evidence.js')
const {
  validateActualEvidence,
  verifyActualImageFiles,
  verifyActualSourceFiles,
} = require('../../server/services/pptx-import/oracle/actual-evidence.js')
const {
  compareCorpusToGoldens,
} = require('../../server/services/pptx-import/oracle/compare-goldens.js')
const { getMilestone } = require('../../server/services/pptx-import/sla-contract.js')

export function verifyVisualSummary(comparison, count) {
  const threshold = getMilestone('phase08_full')
  const valid =
    comparison?.failed === false &&
    comparison.deckCount === count &&
    Number.isSafeInteger(comparison.slideCount) &&
    comparison.slideCount >= count &&
    Number.isFinite(comparison.meanSsim) &&
    Number.isFinite(comparison.minSsim) &&
    comparison.meanSsim >= threshold.meanSsim &&
    comparison.meanSsim <= 1 &&
    comparison.minSsim >= threshold.minSsim &&
    comparison.minSsim <= comparison.meanSsim
  return { valid, reasons: valid ? [] : ['feature-visual-below-native-gate'] }
}

export async function verifyFeatureVisualEvidence({ root, manifest, evidenceDir }) {
  let report
  try {
    report = JSON.parse(await readFile(path.join(evidenceDir, 'feature-visual.json'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    return { valid: false, reasons: ['missing-feature-visual-evidence'] }
  }
  const reasons = []
  if (
    report.schemaVersion !== 1 ||
    report.manifestDigest !== manifestDigest(manifest) ||
    report.implementationDigest !== (await implementationDigest(root))
  ) {
    reasons.push('feature-visual-binding-mismatch')
  }
  const expected = manifest.featureFixtures.map((fixture) => ({
    id: `${fixture.id}.pptx`,
    sha256: fixture.sha256,
    byteLength: fixture.byteLength,
  }))
  if (JSON.stringify(report.corpus?.decks) !== JSON.stringify(expected) || !expected.length) {
    return { valid: false, reasons: [...reasons, 'feature-visual-source-domain-mismatch'] }
  }
  const corpus = report.corpus
  const golden = report.golden
  const actual = report.actual
  const count = expected.length
  const corpusDir = path.join(evidenceDir, 'feature-corpus')
  const goldensDir = path.join(evidenceDir, 'feature-goldens')
  const actualsDir = path.join(evidenceDir, 'feature-actuals')
  const validations = [
    validateGoldenEvidence({
      corpusManifest: corpus,
      goldenManifest: golden,
      requiredDeckCount: count,
    }),
    validateActualEvidence({
      corpusManifest: corpus,
      actualManifest: actual,
      requiredDeckCount: count,
    }),
    await verifyGoldenSourceFiles({
      corpusManifest: corpus,
      goldenManifest: golden,
      corpusDir,
      requiredDeckCount: count,
    }),
    await verifyActualSourceFiles({
      corpusManifest: corpus,
      actualManifest: actual,
      corpusDir,
      requiredDeckCount: count,
    }),
    await verifyGoldenImageFiles({
      corpusManifest: corpus,
      goldenManifest: golden,
      goldensDir,
      requiredDeckCount: count,
    }),
    await verifyActualImageFiles({
      corpusManifest: corpus,
      actualManifest: actual,
      actualsDir,
      requiredDeckCount: count,
    }),
  ]
  for (const validation of validations) if (!validation.valid) reasons.push(...validation.reasons)
  if (reasons.length) return { valid: false, reasons: [...new Set(reasons)].sort() }
  const comparison = await compareCorpusToGoldens({
    corpusDir,
    goldensDir,
    actualsDir,
    goldenManifest: golden,
    actualManifest: actual,
  })
  reasons.push(...verifyVisualSummary(comparison, count).reasons)
  return { valid: reasons.length === 0, reasons }
}
