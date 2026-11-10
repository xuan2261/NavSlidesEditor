import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  inspectSemanticManifest,
  verifyOperationResults,
  qualifySemanticCoverage,
} from '../../scripts/ci/pptx-semantic-coverage-gate.mjs'

const root = resolve('.')
const manifest = () =>
  readFile(resolve(root, 'tests/pptx-semantic/manifest.json'), 'utf8').then(JSON.parse)

describe('semantic PPTX coverage admission (not native qualification)', () => {
  it('pins all original corpus bytes and dimensions without claiming editability', async () => {
    const result = await inspectSemanticManifest(root, await manifest())
    expect(result).toMatchObject({ ok: true, scope: 'inventory-only', corpusCount: 11 })
    expect(result).not.toHaveProperty('qualified', true)
  })

  it('rejects source hash drift even when the declared deck count is unchanged', async () => {
    const changed = await manifest()
    changed.corpus[0].sha256 = '0'.repeat(64)
    expect((await inspectSemanticManifest(root, changed)).errors).toContain(
      'corpus-source-mismatch'
    )
  })

  it('does not allow an operation or an object family to be removed from the contract', async () => {
    const changed = await manifest()
    changed.operations = changed.operations.filter((row) => row.family !== 'diagram')
    expect((await inspectSemanticManifest(root, changed)).errors).toContain(
      'operation-domain-mismatch'
    )
  })

  it('rejects a lower visual threshold instead of treating it as a candidate policy', async () => {
    const changed = await manifest()
    changed.visualPolicy.minSsim = 0.1
    expect((await inspectSemanticManifest(root, changed)).errors).toContain(
      'visual-policy-mismatch'
    )
  })

  it('verifies generated feature bytes instead of trusting a source-feature label', async () => {
    const changed = await manifest()
    changed.featureFixtures = [{ id: 'source-authored-semantic-features', sha256: '0'.repeat(64) }]
    expect((await inspectSemanticManifest(root, changed)).errors).toContain(
      'feature-source-mismatch'
    )
  })

  it('requires dedicated editable path, adjustment and connector source cases', async () => {
    const changed = await manifest()
    changed.featureFixtures = changed.featureFixtures.filter(
      (row) => row.id !== 'source-authored-drawingml-geometry'
    )
    expect((await inspectSemanticManifest(root, changed)).errors).toContain(
      'feature-source-mismatch'
    )
  })

  it('rejects passing summary text and skipped negative assertions', () => {
    const operations = [{ id: 'text.content' }]
    expect(verifyOperationResults(operations, { success: true, testResults: [] }).ok).toBe(false)
    const assertions = [
      { title: 'text.content:edit-save-reload', status: 'passed' },
      { title: 'text.content:reject-invalid', status: 'pending' },
    ]
    const report = {
      success: true,
      numTotalTests: 2,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 1,
      testResults: [{ assertionResults: assertions }],
    }
    expect(verifyOperationResults(operations, report).errors).toContain(
      'missing-passed-assertion:text.content:reject-invalid'
    )
  })

  it('extracts exact machine-consumed case IDs from runner results, not their prose', () => {
    const operations = [{ id: 'text.content' }]
    const assertions = ['edit-save-reload', 'reject-invalid'].map((kind) => ({
      title: `text.content:${kind}`,
      status: 'passed',
    }))
    const report = {
      success: true,
      numTotalTests: 2,
      numPassedTests: 2,
      numFailedTests: 0,
      numPendingTests: 0,
      testResults: [{ assertionResults: assertions }],
    }
    expect(verifyOperationResults(operations, report)).toEqual({ ok: true, errors: [] })
    assertions.push(assertions[0])
    expect(verifyOperationResults(operations, report).errors).toContain('runner-count-mismatch')
  })

  it('never qualifies an inventory-only run without independent visual and semantic evidence', async () => {
    const result = await qualifySemanticCoverage({
      root,
      manifest: await manifest(),
      evidenceDir: resolve(root, 'tests/pptx-semantic/missing-evidence'),
    })
    expect(result.qualified).toBe(false)
    expect(result.errors).toContain('missing-semantic-runner-evidence')
    expect(result.errors).toContain('missing-evidence-manifest')
  })
})
