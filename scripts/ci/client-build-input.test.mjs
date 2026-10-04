import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createSubject } from '../feature-inventory/education-qualification-stage.mjs'
import { createManifest } from './create-client-dist-manifest.mjs'
import { verifyManifest } from './verify-client-dist-manifest.mjs'
const { verifyClientArtifact } = createRequire(import.meta.url)('./artifact-manifest-runtime.cjs')
const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const baseDir = mkdtempSync(join(tmpdir(), 'client-input-'))
  roots.push(baseDir)
  const root = join(baseDir, 'client/dist'),
    source = join(baseDir, 'client/src/app.js')
  mkdirSync(root, { recursive: true })
  mkdirSync(join(baseDir, 'client/src'))
  writeFileSync(source, 'revision A')
  writeFileSync(join(root, 'index.html'), 'compiled A')
  writeFileSync(join(baseDir, 'package-lock.json'), '{}')
  return {
    baseDir,
    root,
    source,
    out: join(baseDir, 'client-dist-manifest.json'),
    subject: 'a'.repeat(40),
    dirty: false,
    buildCommand: 'npm run build',
    viteVersion: '8.2.2',
  }
}
function capture(data) {
  const inputHash = createSubject(data.baseDir).subjectHash
  writeFileSync(data.out, JSON.stringify(createManifest({ ...data, inputHash })))
  return inputHash
}
function verify(data, expectedInputHash) {
  return verifyClientArtifact({
    rootDir: data.root,
    manifestPath: data.out,
    expectedSubject: data.subject,
    expectedInputHash,
  })
}
describe('exact compiled client input admission', () => {
  it('rejects a manifest without a compilation input capture', () => {
    const data = fixture()
    expect(() => createManifest(data)).toThrow(/input|source/i)
  })
  it('rejects unchanged old output after source changes and admits a fresh exact-input artifact', () => {
    const data = fixture(),
      first = capture(data)
    verify(data, first)
    writeFileSync(data.source, 'revision B')
    const frozen = createSubject(data.baseDir).subjectHash
    expect(() => verify(data, frozen)).toThrow(/input|source/i)
    expect(() =>
      verifyManifest({ ...data, manifest: data.out, expectedInputHash: frozen })
    ).toThrow(/input|source/i)
    writeFileSync(join(data.root, 'index.html'), 'compiled B')
    capture(data)
    expect(verify(data, frozen).inputHash).toBe(frozen)
  })
  it('rejects embedded client manifest from another frozen source while preserving output checks', () => {
    const data = fixture(),
      original = capture(data)
    const resources = join(data.baseDir, 'resources')
    mkdirSync(resources)
    writeFileSync(join(resources, 'client-dist-manifest.json'), readFileSync(data.out))
    expect(() =>
      verifyClientArtifact({
        rootDir: data.root,
        manifestPath: join(resources, 'client-dist-manifest.json'),
        expectedInputHash: 'b'.repeat(64),
      })
    ).toThrow(/input|source/i)
    writeFileSync(join(data.root, 'index.html'), 'tampered same length')
    expect(() => verify(data, original)).toThrow(/size|hash/i)
  })
  it('checks before and after a real compilation and never publishes a changed-input build', async () => {
    const data = fixture()
    const { buildClientDist } = await import('./build-client-dist.mjs')
    const compile = () =>
      execFileSync(process.execPath, [
        '-e',
        'const fs=require("node:fs");fs.writeFileSync(process.argv[1],fs.readFileSync(process.argv[2]))',
        join(data.root, 'index.html'),
        data.source,
      ])
    await buildClientDist(data, compile)
    const captured = JSON.parse(readFileSync(data.out, 'utf8')).build.inputHash
    expect(verify(data, createSubject(data.baseDir).subjectHash).inputHash).toBe(captured)
    rmSync(data.out)
    const changingCompile = () => {
      compile()
      writeFileSync(data.source, 'changed while compiling')
    }
    await expect(buildClientDist(data, changingCompile)).rejects.toThrow(/input|source/i)
    expect(existsSync(data.out)).toBe(false)
  })
  it('does not let generated output churn alter the captured input identity', () => {
    const data = fixture(),
      initial = createSubject(data.baseDir).subjectHash
    capture(data)
    writeFileSync(join(data.root, 'index.html'), 'new build output')
    expect(createSubject(data.baseDir).subjectHash).toBe(initial)
  })
})
