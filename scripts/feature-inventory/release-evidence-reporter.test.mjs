import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import EducationEvidenceReporter from '../../tests/e2e/education/release-evidence-reporter.js'
import { mergePackageReceipt } from './education-evidence-validation.mjs'
import { fileHash } from './education-evidence-files.mjs'
import {
  scenarioAttachment,
  collectScenarioRecords,
} from '../../tests/e2e/education/release-evidence-adapter.js'
const cell = {
  capabilityId: 'game.poll.try',
  element: 'game',
  gameType: 'poll',
  questionKind: null,
  presetId: null,
  surface: 'try',
  mode: 'local',
  scenarioId: 'complete-reset',
  lane: 'production-browser',
}
describe('actual scenario evidence adapter', () => {
  it('never converts a test pass into coverage without explicit observations', () => {
    expect(collectScenarioRecords([], 'passed')).toEqual([])
    expect(() =>
      scenarioAttachment(cell, { expected: 'test passed', observed: 'test passed' })
    ).toThrow()
    expect(() =>
      scenarioAttachment(cell, { expected: { passed: true }, observed: { passed: true } })
    ).toThrow()
  })
  it('keeps actual test failure dominant over an attached scenario pass', () => {
    const attachment = scenarioAttachment(cell, {
      expected: { votes: 1 },
      observed: { votes: 1 },
      artifacts: ['poll.png'],
    })
    expect(collectScenarioRecords([attachment], 'failed')[0].result).toBe('failed')
  })
  it('rejects malformed observation attachments instead of silently ignoring them', () => {
    expect(() =>
      collectScenarioRecords([{ name: 'education-scenario', body: Buffer.from('{}') }], 'passed')
    ).toThrow()
  })
})

const temporary = []
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true })
})
function runFixture(lane = 'production-browser') {
  const root = mkdtempSync(join(tmpdir(), 'education-reporter-'))
  temporary.push(root)
  const proof = join(root, 'proof.png'),
    executable = join(root, 'qualified.exe')
  writeFileSync(proof, 'actual scenario artifact')
  writeFileSync(executable, 'qualified executable')
  const context = {
    schemaVersion: 1,
    runId: 'reporter-run',
    subjectHash: 'a'.repeat(64),
    policyHash: 'b'.repeat(64),
    lanes: {
      [lane]: {
        artifactHashes: { client: 'c'.repeat(64), exe: fileHash(executable) },
        runtimeVersion: '42.9.3',
      },
    },
  }
  const contextPath = join(root, 'context.json'),
    evidencePath = join(root, 'evidence.json'),
    packagePath = join(root, 'package.json')
  writeFileSync(contextPath, JSON.stringify(context))
  vi.stubEnv('NAVSLIDES_EDUCATION_CONTEXT', contextPath)
  vi.stubEnv('NAVSLIDES_EDUCATION_EVIDENCE', evidencePath)
  vi.stubEnv('NAVSLIDES_EDUCATION_PACKAGE_RECEIPT', lane === 'windows-packaged' ? packagePath : '')
  vi.stubEnv('PLAYWRIGHT_USE_DEV_SERVERS', '0')
  const reporter = new EducationEvidenceReporter()
  reporter.onBegin()
  const scenario = { ...cell, lane }
  const attachment = scenarioAttachment(scenario, {
    expected: { votes: 1, reset: true },
    observed: { votes: 1, reset: true },
    artifacts: [proof],
    execution: { executablePath: executable },
  })
  const test = {
    title: 'actual poll',
    titlePath: () => ['actual poll'],
    parent: { project: () => ({ name: 'chromium' }) },
    location: { file: join(root, 'tests/e2e/education/poll.spec.js') },
    annotations: [],
  }
  reporter.onTestEnd(test, { status: 'passed', attachments: [attachment], retry: 0, errors: [] })
  return { reporter, evidencePath, packagePath, context, scenario }
}
describe('persisted runner outcome', () => {
  it.each(['failed', 'timedout', 'interrupted'])(
    'fails persisted browser evidence after passed cells and overall %s',
    (status) => {
      const { reporter, evidencePath } = runFixture()
      expect(reporter.onEnd({ status })?.status).toBe(status)
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
      expect(evidence.records[0].result).toBe('passed')
      expect(evidence.executionFailures).toEqual(
        expect.arrayContaining([expect.objectContaining({ result: status })])
      )
    }
  )
  it('persists a global worker teardown error even when FullResult says passed', () => {
    const { reporter, evidencePath } = runFixture()
    reporter.onError({ message: 'Worker teardown failed after scenario completion' })
    expect(reporter.onEnd({ status: 'passed' })?.status).toBe('failed')
    expect(JSON.parse(readFileSync(evidencePath, 'utf8')).executionFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ errors: ['Worker teardown failed after scenario completion'] }),
      ])
    )
  })
  it.each(['failed', 'timedout', 'interrupted'])(
    'makes main evidence and package import fail on overall %s',
    (status) => {
      const { reporter, evidencePath, packagePath, context, scenario } =
        runFixture('windows-packaged')
      expect(reporter.onEnd({ status })?.status).toBe(status)
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')),
        receipt = JSON.parse(readFileSync(packagePath, 'utf8'))
      expect(evidence.executionFailures).toEqual(
        expect.arrayContaining([expect.objectContaining({ result: status })])
      )
      expect(receipt.records[0].result).toBe('passed')
      expect(receipt.executionFailures).toEqual(
        expect.arrayContaining([expect.objectContaining({ result: status })])
      )
      expect(() => mergePackageReceipt(evidence, receipt, context, [scenario])).toThrow(
        /failed|skipped/i
      )
    }
  )
  it('persists a global error to an existing package receipt even when no packaged cell completed', () => {
    const { reporter, evidencePath, packagePath, context } = runFixture('windows-packaged')
    reporter.pending = []
    writeFileSync(packagePath, JSON.stringify({ ...context, records: [], executionFailures: [] }))
    reporter.onError({ message: 'Packaged worker could not start' })
    expect(reporter.onEnd({ status: 'failed' })?.status).toBe('failed')
    for (const path of [evidencePath, packagePath])
      expect(JSON.parse(readFileSync(path, 'utf8')).executionFailures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ errors: ['Packaged worker could not start'] }),
        ])
      )
  })
  it('retains earlier skipped execution when a subsequent run passes', () => {
    const { reporter, evidencePath, context } = runFixture()
    const prior = { testTitle: 'earlier required journey', result: 'skipped', errors: [] }
    writeFileSync(
      evidencePath,
      JSON.stringify({ ...context, records: [], executionFailures: [prior] })
    )
    expect(reporter.onEnd({ status: 'passed' })).toBeUndefined()
    expect(JSON.parse(readFileSync(evidencePath, 'utf8')).executionFailures).toEqual([prior])
  })
  it('keeps clean passed evidence free of execution failures', () => {
    const { reporter, evidencePath } = runFixture()
    expect(reporter.onEnd({ status: 'passed' })).toBeUndefined()
    expect(JSON.parse(readFileSync(evidencePath, 'utf8')).executionFailures).toEqual([])
  })
})
