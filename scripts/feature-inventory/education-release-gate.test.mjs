import { describe, expect, it } from 'vitest'
import { evaluateEvidence, mergePackageReceipt } from './education-evidence-validation.mjs'
import { runEducationGate } from './education-release-gate.mjs'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileHash } from './education-evidence-files.mjs'

const hash = 'a'.repeat(64)
const cell = {
  capabilityId: 'game.quiz.file',
  element: 'game',
  gameType: 'quiz',
  questionKind: 'ordering',
  presetId: null,
  surface: 'file',
  mode: 'local',
  scenarioId: 'complete-reset',
  lane: 'production-browser',
}
const lane = {
  artifactHashes: { client: hash, shared: hash, vendor: hash },
  runtimeVersion: '6.0.2',
  environment: 'win32',
  browser: 'chromium',
  browserVersion: '153.0.8010.12',
  project: 'chromium',
  viewport: { width: 1280, height: 720 },
  protocol: 'file:',
}
const context = {
  schemaVersion: 1,
  runId: 'run-1',
  subjectHash: hash,
  policyHash: hash,
  frozenAt: '2026-10-02T00:00:00.000Z',
  lanes: {
    'production-browser': { ...lane, protocol: ['http:', 'file:'], projects: ['chromium'] },
  },
}
const record = () => ({
  ...cell,
  ...lane,
  schemaVersion: 1,
  runId: context.runId,
  subjectHash: hash,
  policyHash: hash,
  testTitle: 'ordering completes and resets',
  expected: { order: ['a', 'b'], reset: true },
  observed: { order: ['a', 'b'], reset: true },
  result: 'passed',
  timestamp: '2026-10-02T00:01:00.000Z',
  artifactPaths: ['proof.png'],
  artifactFileHashes: { 'proof.png': hash },
  limitations: [],
})
const evaluate = (records) =>
  evaluateEvidence({ records, context, requiredCells: [cell], verifyArtifacts: () => true })

describe('conjunctive education evidence', () => {
  it('requires every exact cell even when editor results are green', () => {
    expect(evaluate([]).ok).toBe(false)
    expect(evaluate([record()]).ok).toBe(true)
    expect(evaluate([{ ...record(), surface: 'present' }]).ok).toBe(false)
  })
  it.each(['skipped', 'failed', 'timedOut', 'TAGGED', 'INVENTORY'])(
    'never accepts %s',
    (result) => {
      expect(evaluate([{ ...record(), result }]).ok).toBe(false)
    }
  )
  it('does not let a duplicate pass conceal a failure or stale receipt', () => {
    expect(evaluate([record(), { ...record(), result: 'failed' }]).ok).toBe(false)
    expect(evaluate([record(), { ...record(), runId: 'old-run' }]).ok).toBe(false)
  })
  it.each([
    ['subjectHash', 'b'.repeat(64)],
    ['policyHash', 'b'.repeat(64)],
    ['browser', 'webkit'],
    ['project', 'mobile'],
    ['mode', 'live'],
    ['runtimeVersion', 'old'],
    ['browserVersion', 'different-version'],
    ['artifactHashes', { client: 'b'.repeat(64), shared: hash, vendor: hash }],
    ['timestamp', '2026-10-01T00:00:00.000Z'],
    ['observed', {}],
    ['expected', 'test passed'],
    ['artifactPaths', []],
    ['viewport', { width: 0, height: 720 }],
    ['protocol', 'https:'],
  ])('rejects mismatched or absent %s', (field, value) => {
    expect(evaluate([{ ...record(), [field]: value }]).ok).toBe(false)
  })
  it('verifies attached bytes rather than trusting the receipt digest', () => {
    const root = mkdtempSync(join(tmpdir(), 'evidence-bytes-'))
    try {
      const path = join(root, 'proof.png')
      writeFileSync(path, 'observed screenshot bytes')
      const actual = {
        ...record(),
        artifactPaths: [path],
        artifactFileHashes: { [path]: fileHash(path) },
      }
      expect(evaluateEvidence({ records: [actual], context, requiredCells: [cell] }).ok).toBe(true)
      writeFileSync(path, 'different artifact bytes')
      expect(evaluateEvidence({ records: [actual], context, requiredCells: [cell] }).ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('refuses an unknown cell even alongside complete required coverage', () => {
    expect(evaluate([record(), { ...record(), scenarioId: 'invented' }]).ok).toBe(false)
  })
})

describe('package receipt import', () => {
  const packageHashes = { installer: hash, exe: hash, client: hash, shared: hash, vendor: hash }
  const packagedCell = {
    ...cell,
    lane: 'windows-packaged',
    surface: 'desktop',
    scenarioId: 'native-local-csp',
  }
  const packagedContext = {
    ...context,
    lanes: {
      'windows-packaged': {
        ...lane,
        environment: 'win32',
        artifactHashes: packageHashes,
        protocol: ['http:'],
        projects: ['chromium'],
      },
    },
  }
  const receipt = () => ({
    schemaVersion: 1,
    runId: 'run-1',
    subjectHash: hash,
    policyHash: hash,
    artifactHashes: packageHashes,
    records: [{ ...record(), ...packagedCell, artifactHashes: packageHashes, protocol: 'http:' }],
  })
  it('imports only validated exact packaged artifacts and real observations', () => {
    expect(
      mergePackageReceipt({ records: [] }, receipt(), packagedContext, [packagedCell], () => true)
        .records
    ).toHaveLength(1)
  })
  it.each(['installer', 'exe', 'client', 'shared', 'vendor'])(
    'rejects changed %s before merge',
    (key) => {
      const changed = receipt()
      changed.artifactHashes = { ...packageHashes, [key]: 'b'.repeat(64) }
      expect(() =>
        mergePackageReceipt({ records: [] }, changed, packagedContext, [packagedCell], () => true)
      ).toThrow()
    }
  )
  it('rejects source policy run or lane mismatch without merging', () => {
    for (const key of ['subjectHash', 'policyHash', 'runId'])
      expect(() =>
        mergePackageReceipt(
          { records: [] },
          { ...receipt(), [key]: 'wrong' },
          packagedContext,
          [packagedCell],
          () => true
        )
      ).toThrow()
    const wrong = receipt()
    wrong.records[0].lane = 'electron-dev'
    expect(() =>
      mergePackageReceipt({ records: [] }, wrong, packagedContext, [packagedCell], () => true)
    ).toThrow()
  })
  it('rejects the wrong observed executable and non-Windows observations', () => {
    const expectedExe = join(tmpdir(), 'new-qualified-app.exe')
    const executableContext = {
      ...packagedContext,
      lanes: {
        'windows-packaged': {
          ...packagedContext.lanes['windows-packaged'],
          artifactPaths: { exe: expectedExe },
        },
      },
    }
    const correct = receipt()
    correct.records[0].executablePath = expectedExe
    expect(
      mergePackageReceipt({ records: [] }, correct, executableContext, [packagedCell], () => true)
        .records
    ).toHaveLength(1)
    const wrong = receipt()
    wrong.records[0].executablePath = join(tmpdir(), 'old-app.exe')
    expect(() =>
      mergePackageReceipt({ records: [] }, wrong, executableContext, [packagedCell], () => true)
    ).toThrow()
    const foreign = receipt()
    foreign.records[0].environment = 'linux'
    expect(() =>
      mergePackageReceipt({ records: [] }, foreign, packagedContext, [packagedCell], () => true)
    ).toThrow()
  })
})

describe('gate aggregate ownership admission', () => {
  it('fails closed on an ownerless lock before inspecting or replacing aggregate evidence', async () => {
    const root = mkdtempSync(join(tmpdir(), 'education-gate-owner-'))
    try {
      const evidencePath = join(root, 'evidence.json'),
        contextPath = join(root, 'context.json')
      const evidence = JSON.stringify({
        ...context,
        records: [record()],
        executionFailures: [{ result: 'skipped', testTitle: 'prior journey' }],
      })
      writeFileSync(contextPath, JSON.stringify(context))
      writeFileSync(evidencePath, evidence)
      writeFileSync(`${evidencePath}.lock`, '')
      await expect(
        runEducationGate(['--context', contextPath, '--evidence', evidencePath], root)
      ).rejects.toThrow(/ownership|owner|lock/i)
      expect(readFileSync(evidencePath, 'utf8')).toBe(evidence)
      expect(readFileSync(`${evidencePath}.lock`, 'utf8')).toBe('')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
