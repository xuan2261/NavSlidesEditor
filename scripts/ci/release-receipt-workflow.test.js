import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createHostReceipt, createQualificationId, hashReceipt } from './release-receipts.mjs'

const cli = fileURLToPath(new URL('./release-receipt-workflow.mjs', import.meta.url))
const subjectSha = 'a'.repeat(40)
const clientDigest = 'b'.repeat(64)
const policyVersion = 'release-target-policy-v3'
const roots = []
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

function write(root, path, contents) {
  const destination = resolve(root, path)
  mkdirSync(resolve(destination, '..'), { recursive: true })
  writeFileSync(destination, contents)
}

function writeJson(root, path, value) {
  write(root, path, JSON.stringify(value))
}

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'windows-release-receipt-'))
  roots.push(root)
  const workspace = '{}\n'
  const electron = '{"lockfileVersion":3}\n'
  write(root, 'package-lock.json', workspace)
  write(root, 'electron/server-package-lock.json', electron)
  const base = {
    schemaVersion: 'release-receipt-v1',
    policyVersion,
    subjectSha,
    clientDigest,
    lockHashes: { workspace: hash(workspace), electron: hash(electron) },
  }
  const qualificationId = createQualificationId(base)
  const linux = createHostReceipt({
    ...base,
    qualificationId,
    host: 'linux-ci',
    status: 'passed',
    gates: { 'client-manifest': hash('manifest') },
  })
  writeJson(root, 'evidence/linux/linux-ci-receipt.json', linux)
  writeJson(root, 'evidence/officecli/officecli-receipt.json', {
    status: 'passed',
    subjectSha,
    clientDigest,
  })
  writeJson(root, 'evidence/runtime-closure.json', {
    clientDist: true,
    clientSubject: subjectSha,
    clientArtifactIdentity: hash('client-artifact'),
    vendorFiles: 1,
    serverModules: 9,
  })
  return { root, linux }
}

function run(root) {
  return spawnSync(process.execPath, [cli, 'windows', subjectSha, clientDigest, policyVersion], {
    cwd: root,
    encoding: 'utf8',
  })
}

function expectFailure(root, message) {
  const result = run(root)
  expect(result.status, result.stderr).not.toBe(0)
  expect(result.stderr).toMatch(message)
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('Windows release receipt workflow', () => {
  it('creates exact-subject OfficeCLI and runtime evidence without a fidelity receipt', () => {
    const { root, linux } = fixture()
    const result = run(root)
    expect(result.status, result.stderr).toBe(0)
    const receipt = JSON.parse(
      readFileSync(resolve(root, 'windows-qualification-receipt.json'), 'utf8')
    )
    expect(receipt).toMatchObject({
      host: 'windows',
      status: 'passed',
      subjectSha,
      parentReceiptHash: hashReceipt(linux),
      gates: {
        'electron-runtime-closure': hash(
          readFileSync(resolve(root, 'evidence/runtime-closure.json'))
        ),
        'officecli-physical': hashReceipt(
          JSON.parse(
            readFileSync(resolve(root, 'evidence/officecli/officecli-receipt.json'), 'utf8')
          )
        ),
      },
    })
    expect(Object.keys(receipt.gates).sort()).toEqual([
      'electron-runtime-closure',
      'officecli-physical',
    ])
  })

  it('never claims a fidelity gate even when fidelity evidence is injected', () => {
    const { root } = fixture()
    writeJson(root, 'evidence/fidelity/powerpoint-receipt.json', {
      status: 'passed',
      subjectSha,
      clientDigest,
    })
    const result = run(root)
    expect(result.status, result.stderr).toBe(0)
    const receipt = JSON.parse(
      readFileSync(resolve(root, 'windows-qualification-receipt.json'), 'utf8')
    )
    expect(receipt.gates).toEqual({
      'electron-runtime-closure': hash(
        readFileSync(resolve(root, 'evidence/runtime-closure.json'))
      ),
      'officecli-physical': hashReceipt(
        JSON.parse(readFileSync(resolve(root, 'evidence/officecli/officecli-receipt.json'), 'utf8'))
      ),
    })
    expect(receipt.artifacts).toEqual({})
  })

  it.each([
    [
      'failed OfficeCLI',
      { status: 'failed', subjectSha, clientDigest },
      /OfficeCLI physical receipt did not pass/,
    ],
    [
      'wrong OfficeCLI subject',
      { status: 'passed', subjectSha: 'c'.repeat(40), clientDigest },
      /OfficeCLI subject mismatch/,
    ],
    [
      'wrong OfficeCLI digest',
      { status: 'passed', subjectSha, clientDigest: 'd'.repeat(64) },
      /OfficeCLI client digest mismatch/,
    ],
  ])('rejects %s', (_label, office, message) => {
    const { root } = fixture()
    writeJson(root, 'evidence/officecli/officecli-receipt.json', office)
    expectFailure(root, message)
  })

  it('rejects a missing OfficeCLI receipt', () => {
    const { root } = fixture()
    unlinkSync(resolve(root, 'evidence/officecli/officecli-receipt.json'))
    expectFailure(root, /expected one receipt/)
  })

  it('rejects malformed OfficeCLI evidence', () => {
    const { root } = fixture()
    write(root, 'evidence/officecli/officecli-receipt.json', '{')
    expectFailure(root, /JSON|Unexpected end/)
  })

  it.each([
    ['malformed runtime JSON', '{', /JSON|Unexpected end/],
    ['incomplete runtime evidence', '{}', /Windows runtime closure receipt invalid/],
    [
      'different runtime subject',
      JSON.stringify({
        clientDist: true,
        clientSubject: 'c'.repeat(40),
        clientArtifactIdentity: hash('client-artifact'),
      }),
      /Windows runtime closure receipt invalid or subject mismatch/,
    ],
  ])('rejects %s', (_label, runtime, message) => {
    const { root } = fixture()
    write(root, 'evidence/runtime-closure.json', runtime)
    expectFailure(root, message)
  })

  it('rejects missing runtime evidence', () => {
    const { root } = fixture()
    unlinkSync(resolve(root, 'evidence/runtime-closure.json'))
    expectFailure(root, /ENOENT/)
  })
})
