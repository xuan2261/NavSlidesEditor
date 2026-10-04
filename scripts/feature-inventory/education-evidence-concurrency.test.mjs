import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import EducationEvidenceReporter from '../../tests/e2e/education/release-evidence-reporter.js'
import { scenarioAttachment } from '../../tests/e2e/education/release-evidence-adapter.js'
import { fileHash } from './education-evidence-files.mjs'

const roots = []
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture(lane) {
  const root = mkdtempSync(join(tmpdir(), 'education-concurrent-'))
  roots.push(root)
  const evidence = join(root, 'evidence.json'),
    receipt = join(root, 'receipt.json'),
    proof = join(root, 'proof.png')
  const exe = join(root, 'qualified.exe'),
    contextPath = join(root, 'context.json')
  writeFileSync(proof, 'actual recorded bytes')
  writeFileSync(exe, 'qualified executable')
  const context = {
    schemaVersion: 1,
    runId: 'exclusive-run',
    subjectHash: 'a'.repeat(64),
    policyHash: 'b'.repeat(64),
    lanes: { [lane]: { artifactHashes: { exe: fileHash(exe) }, runtimeVersion: '42.9.3' } },
  }
  writeFileSync(contextPath, JSON.stringify(context))
  const earlier = {
    testTitle: 'earlier failed invocation',
    result: 'failed',
    errors: ['failure retained'],
  }
  for (const path of [evidence, receipt])
    writeFileSync(path, JSON.stringify({ ...context, records: [], executionFailures: [earlier] }))
  vi.stubEnv('NAVSLIDES_EDUCATION_CONTEXT', contextPath)
  vi.stubEnv('NAVSLIDES_EDUCATION_EVIDENCE', evidence)
  vi.stubEnv('NAVSLIDES_EDUCATION_PACKAGE_RECEIPT', lane === 'windows-packaged' ? receipt : '')
  vi.stubEnv('PLAYWRIGHT_USE_DEV_SERVERS', '0')
  const attachment = scenarioAttachment(
    {
      capabilityId: 'game.poll.try',
      element: 'game',
      gameType: 'poll',
      questionKind: null,
      presetId: null,
      surface: 'try',
      mode: 'local',
      scenarioId: 'complete-reset',
      lane,
    },
    {
      expected: { votes: 1 },
      observed: { votes: 1 },
      artifacts: [proof],
      execution: { executablePath: exe },
    }
  )
  const testFile = join(root, 'tests/e2e/education/poll.spec.js')
  const result = { status: 'passed', attachments: [attachment], retry: 0, errors: [] }
  const resultPath = join(root, 'result.json')
  writeFileSync(resultPath, JSON.stringify(result))
  return { root, evidence, receipt, result, resultPath, testFile, earlier }
}
const test = (title, file) => ({
  title,
  titlePath: () => [title],
  parent: { project: () => ({ name: 'chromium' }) },
  location: { file },
  annotations: [],
})
const workerCode = `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
(async () => {
  const Reporter = (await import(process.env.REPORTER_URL)).default;
  const reporter = new Reporter(); reporter.onBegin();
  const result = JSON.parse(fs.readFileSync(process.env.RESULT_PATH, 'utf8'));
  for (const attachment of result.attachments) attachment.body = Buffer.from(attachment.body.data);
  result.status = 'skipped';
  reporter.onTestEnd({ title: 'skipped writer', titlePath: () => ['skipped writer'],
    parent: { project: () => ({ name: 'chromium' }) }, location: { file: process.env.TEST_FILE }, annotations: [] }, result);
  const read = fs.readFileSync;
  fs.readFileSync = function(path, ...args) {
    const bytes = read.call(fs, path, ...args);
    if (String(path) === process.env.PAUSED_PATH) {
      process.send({ event: 'snapshot-read' });
      const deadline = Date.now() + 15000;
      while (!fs.existsSync(process.env.RELEASE_PATH)) {
        if (Date.now() > deadline) throw new Error('Controlled merge release was not signalled');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    }
    return bytes;
  };
  syncBuiltinESMExports();
  const outcome = reporter.onEnd({ status: 'failed' });
  process.send({ event: 'completed', outcome });
  process.disconnect();
})().catch(error => { process.send({ event: 'worker-error', message: error.stack }); process.exitCode = 1; process.disconnect(); });
`
function message(child, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`No worker ${event} message`)), 20000)
    const finish = (error, value) => {
      clearTimeout(timer)
      child.off('message', receive)
      child.off('error', fail)
      child.off('exit', exit)
      error ? reject(error) : resolve(value)
    }
    const receive = (value) => {
      if (value.event === 'worker-error') finish(new Error(value.message))
      else if (value.event === event) finish(null, value)
    }
    const fail = (error) => finish(error)
    const exit = (code) => finish(new Error(`Worker exited before ${event}: ${code}`))
    child.on('message', receive)
    child.on('error', fail)
    child.on('exit', exit)
  })
}
describe('exclusive cross-process evidence merge', () => {
  it.each(['production-browser', 'windows-packaged'])(
    'never loses a skipped %s writer or earlier failure',
    async (lane) => {
      const setup = fixture(lane),
        release = join(setup.root, 'release')
      const reporter = new EducationEvidenceReporter()
      reporter.onBegin()
      reporter.onTestEnd(test('passing writer', setup.testFile), setup.result)
      const child = spawn(process.execPath, ['-e', workerCode], {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: {
          ...process.env,
          REPORTER_URL: new URL(
            '../../tests/e2e/education/release-evidence-reporter.js',
            import.meta.url
          ).href,
          RESULT_PATH: setup.resultPath,
          TEST_FILE: setup.testFile,
          RELEASE_PATH: release,
          PAUSED_PATH: lane === 'windows-packaged' ? setup.receipt : setup.evidence,
        },
      })
      try {
        await message(child, 'snapshot-read')
        const completed = message(child, 'completed')
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const passingOutcome = reporter.onEnd({ status: 'passed' })
        writeFileSync(release, 'release paused writer')
        await completed
        const evidence = JSON.parse(readFileSync(setup.evidence, 'utf8'))
        const target =
          lane === 'windows-packaged' ? JSON.parse(readFileSync(setup.receipt, 'utf8')) : evidence
        expect(evidence.executionFailures).toContainEqual(setup.earlier)
        expect(target.executionFailures).toContainEqual(
          expect.objectContaining({ testTitle: 'skipped writer', result: 'skipped' })
        )
        expect(target.records.map((record) => record.testTitle)).toContain('skipped writer')
        if (passingOutcome?.status !== 'failed')
          expect(target.records.map((record) => record.testTitle)).toContain('passing writer')
      } finally {
        writeFileSync(release, 'always release')
        child.kill()
      }
    },
    30000
  )
  it('refuses an existing lock without an owner instead of overwriting evidence', () => {
    const setup = fixture('production-browser'),
      before = readFileSync(setup.evidence, 'utf8')
    writeFileSync(`${setup.evidence}.lock`, '')
    const reporter = new EducationEvidenceReporter()
    reporter.onBegin()
    reporter.onTestEnd(test('passing writer', setup.testFile), setup.result)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(reporter.onEnd({ status: 'passed' })?.status).toBe('failed')
    expect(readFileSync(setup.evidence, 'utf8')).toBe(before)
    expect(readFileSync(`${setup.evidence}.lock`, 'utf8')).toBe('')
  })
})
