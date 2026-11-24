import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const {
  parseXml,
  descendants,
  attr,
  P_URIS,
} = require('../../server/services/pptx-import/ooxml-text-run-xml.js')
const { hashCanonical } = require('../../server/services/pptx-import/evidence/canonical-hash.js')
const families = {
  text: ['content', 'run-style', 'paragraph-layout', 'autofit'],
  geometry: ['transform', 'path-control', 'preset-adjustment', 'connector'],
  group: ['child-edit', 'group-ungroup'],
  image: ['replace', 'crop', 'effects'],
  table: ['cell', 'row-column', 'merge'],
  chart: ['data', 'series', 'axes', 'style'],
  diagram: ['label', 'insert-delete', 'reparent-reorder', 'layout-style'],
  equation: ['runs', 'fraction-script', 'matrix'],
  media: ['playback-trim', 'poster-caption'],
  timing: ['order-trigger', 'target'],
  action: ['hyperlink'],
}
export const SEMANTIC_OPERATION_IDS = Object.entries(families).flatMap(([family, operations]) =>
  operations.map((operation) => `${family}.${operation}`)
)
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const manifestDigest = (manifest) => hashCanonical(manifest)
let fixturePromise

// Legacy inventory callers retain generator determinism checks. Native qualification
// uses the separate frozen-byte entry point and never executes fixture builders.
export async function inspectSemanticManifest(root, manifest) {
  return inspectManifest(root, manifest, null)
}

export async function inspectFrozenSemanticManifest(root, manifest, featureCorpusDir) {
  if (typeof featureCorpusDir !== 'string' || !featureCorpusDir)
    throw new Error('frozen-feature-corpus-required')
  return inspectManifest(root, manifest, featureCorpusDir)
}

async function inspectManifest(root, manifest, featureCorpusDir) {
  const errors = []
  if (manifest?.schemaVersion !== 1 || manifest.scope !== 'navslides-semantic-editing') {
    errors.push('invalid-semantic-manifest')
  }
  if (
    manifest?.visualPolicy?.id !== 'phase08_full' ||
    manifest.visualPolicy.meanSsim !== 0.99 ||
    manifest.visualPolicy.minSsim !== 0.97 ||
    manifest.visualPolicy.renderer !== 'Microsoft PowerPoint'
  )
    errors.push('visual-policy-mismatch')
  const operations = manifest?.operations || []
  const operationIds = operations.map((operation) => operation.id)
  if (
    operationIds.length !== SEMANTIC_OPERATION_IDS.length ||
    SEMANTIC_OPERATION_IDS.some((id) => !operationIds.includes(id)) ||
    operations.some((row) => row.family !== row.id?.split('.')[0])
  ) {
    errors.push('operation-domain-mismatch')
  }
  const canonical = JSON.parse(
    await readFile(
      path.resolve(root, 'server/data/test-corpus/importer-qualification-manifest.json'),
      'utf8'
    )
  )
  const corpus = manifest?.corpus || []
  if (
    corpus.length !== canonical.decks.length ||
    new Set(corpus.map((row) => row.id)).size !== corpus.length
  )
    errors.push('corpus-domain-mismatch')
  for (const expected of canonical.decks) {
    const row = corpus.find((deck) => deck.id === expected.id)
    if (
      !row ||
      row.path !== `server/data/test-corpus/${expected.id}` ||
      row.sha256 !== expected.sha256
    ) {
      errors.push('corpus-source-mismatch')
      continue
    }
    const bytes = await readFile(path.resolve(root, row.path))
    if (sha256(bytes) !== row.sha256 || bytes.length !== row.byteLength) {
      errors.push('corpus-source-mismatch')
      continue
    }
    const zip = await JSZip.loadAsync(bytes)
    const roots = parseXml(await zip.file('ppt/presentation.xml').async('string'))
    const sizes = descendants(
      { children: roots },
      (node) => node.local === 'sldSz' && P_URIS.has(node.uri)
    )
    if (
      sizes.length !== 1 ||
      Number(attr(sizes[0], 'cx')) !== row.slideSizeEmu?.width ||
      Number(attr(sizes[0], 'cy')) !== row.slideSizeEmu?.height
    )
      errors.push('corpus-dimensions-mismatch')
  }
  if (featureCorpusDir !== null) {
    const pinned = JSON.parse(await readFile(path.resolve(root, 'tests/pptx-semantic/manifest.json'), 'utf8'))
    const rows = manifest.featureFixtures || [], expected = pinned.featureFixtures
    if (rows.length !== expected.length || new Set(rows.map((row) => row.id)).size !== expected.length)
      errors.push('feature-source-mismatch')
    for (const fixture of expected) {
      const row = rows.find((item) => item.id === fixture.id)
      if (!row || row.builder !== fixture.builder || row.sha256 !== fixture.sha256 ||
        row.byteLength !== fixture.byteLength || hashCanonical(row.dimensionsEmu) !== hashCanonical(fixture.dimensionsEmu) ||
        hashCanonical(row.features) !== hashCanonical(fixture.features)) {
        errors.push('feature-source-mismatch')
        continue
      }
      try {
        const bytes = await readFile(path.resolve(featureCorpusDir, `${fixture.id}.pptx`))
        if (sha256(bytes) !== fixture.sha256 || bytes.length !== fixture.byteLength) {
          errors.push('feature-source-mismatch')
          continue
        }
        const zip = await JSZip.loadAsync(bytes)
        const roots = parseXml(await zip.file('ppt/presentation.xml').async('string'))
        const sizes = descendants(
          { children: roots },
          (node) => node.local === 'sldSz' && P_URIS.has(node.uri)
        )
        if (
          sizes.length !== 1 ||
          Number(attr(sizes[0], 'cx')) !== fixture.dimensionsEmu?.width ||
          Number(attr(sizes[0], 'cy')) !== fixture.dimensionsEmu?.height
        ) {
          errors.push('feature-dimensions-mismatch')
        }
        for (const feature of fixture.features || []) {
          if (!feature.sourceParts.every((part) => zip.file(part))) {
            errors.push('missing-feature-source-part')
          }
        }
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error
        errors.push('missing-frozen-feature-source')
      }
    }
  } else {
    fixturePromise ??= Promise.all([
      import('../../tests/pptx-semantic/feature-fixtures.js').then(({ buildFeatureFixture }) => buildFeatureFixture()),
      import('../../tests/pptx-semantic/geometry-fixtures.js').then(({ buildGeometryFixture }) => buildGeometryFixture()),
    ])
    const fixtures = await fixturePromise
    const generated = manifest.featureFixtures || []
    const builders = [
      'tests/pptx-semantic/feature-fixtures.js',
      'tests/pptx-semantic/geometry-fixtures.js',
    ]
    if (
      generated.length !== fixtures.length ||
      fixtures.some((fixture, index) => {
        const row = generated.find((item) => item.id === fixture.catalogue.id)
        return !row || row.sha256 !== sha256(fixture.buffer) || row.byteLength !== fixture.buffer.length ||
          row.builder !== builders[index]
      })
    ) errors.push('feature-source-mismatch')
  }
  return {
    ok: errors.length === 0,
    scope: 'inventory-only',
    corpusCount: corpus.length,
    manifestDigest: manifestDigest(manifest),
    errors: [...new Set(errors)].sort(),
  }
}
