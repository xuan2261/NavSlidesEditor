import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { identityFor } from './create-client-dist-manifest.mjs'

const repo = path.resolve(__dirname, '..', '..')
const createScript = path.join(repo, 'scripts', 'ci', 'create-client-dist-manifest.mjs')
const verifyScript = path.join(repo, 'scripts', 'ci', 'verify-client-dist-manifest.mjs')
const roots = []
const subject = 'a'.repeat(40)

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'navslides-client-artifact-'))
  roots.push(root)
  const dist = path.join(root, 'client', 'dist')
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(dist, 'index.html'), '<main>NavSlides</main>\n')
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log("ok")\n')
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n')
  return {
    dist,
    lock: path.join(root, 'package-lock.json'),
    manifest: path.join(root, 'client-dist-manifest.json'),
    root,
  }
}

function run(script, args, cwd) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function create(paths) {
  run(
    createScript,
    [
      '--root',
      paths.dist,
      '--out',
      paths.manifest,
      '--subject',
      subject,
      '--dirty',
      'false',
      '--build-command',
      'npm run build',
      '--vite-version',
      '8.2.2',
      '--lock',
      `workspace=${paths.lock}`,
    ],
    paths.root
  )
}

function verify(paths, extra = []) {
  return run(
    verifyScript,
    [
      '--root',
      paths.dist,
      '--manifest',
      paths.manifest,
      '--subject',
      subject,
      '--dirty',
      'false',
      '--build-command',
      'npm run build',
      '--lock',
      `workspace=${paths.lock}`,
      ...extra,
    ],
    paths.root
  )
}

function expectFailure(callback, message) {
  expect(callback).toThrow(expect.objectContaining({ stderr: expect.stringContaining(message) }))
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true })
})

describe('client artifact manifest', () => {
  it('is deterministic and binds build, subject, locks, and normalized file identity', () => {
    const paths = fixture()
    create(paths)
    const first = fs.readFileSync(paths.manifest, 'utf8')
    create(paths)
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'))

    expect(fs.readFileSync(paths.manifest, 'utf8')).toBe(first)
    expect(manifest.subject).toEqual({ sha: subject, dirty: false })
    expect(manifest.build.command).toBe('npm run build')
    expect(manifest.build.vite).toBe('8.2.2')
    expect(manifest.locks[0].sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.files.map((entry) => entry.path)).toEqual(['assets/app.js', 'index.html'])
    expect(manifest.artifact.identity).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(verify(paths)).artifactIdentity).toBe(manifest.artifact.identity)
  })

  it.each([
    ['missing', (paths) => fs.rmSync(path.join(paths.dist, 'index.html')), 'missing'],
    ['extra', (paths) => fs.writeFileSync(path.join(paths.dist, 'extra.txt'), 'x'), 'extra'],
    ['altered', (paths) => fs.writeFileSync(path.join(paths.dist, 'index.html'), 'changed'), 'size'],
  ])('rejects %s artifact files', (_name, mutate, message) => {
    const paths = fixture()
    create(paths)
    mutate(paths)
    expectFailure(() => verify(paths), message)
  })

  it('rejects traversal, duplicate, and case-colliding manifest paths', () => {
    const paths = fixture()
    create(paths)
    const original = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'))
    for (const files of [
      [{ ...original.files[0], path: '../escape.js' }],
      [original.files[0], original.files[0]],
      [original.files[0], { ...original.files[0], path: original.files[0].path.toUpperCase() }],
    ]) {
      fs.writeFileSync(paths.manifest, JSON.stringify({ ...original, files }))
      expectFailure(() => verify(paths), 'path')
    }
  })

  it('rejects symlinks or reparse points in the artifact tree', () => {
    const paths = fixture()
    const outside = path.join(paths.root, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'escaped.txt'), 'x')
    fs.symlinkSync(outside, path.join(paths.dist, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')

    expectFailure(() => create(paths), 'symbolic link or reparse point')
  })

  it('rejects non-NFC filenames instead of silently renaming manifest paths', () => {
    const paths = fixture()
    fs.writeFileSync(path.join(paths.dist, `e\u0301.js`), 'x')
    expectFailure(() => create(paths), 'NFC-normalized')
  })

  it('rejects duplicate lock names even when lock paths differ', () => {
    const paths = fixture()
    create(paths)
    const copy = path.join(paths.root, 'package-lock-copy.json')
    fs.copyFileSync(paths.lock, copy)
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'))
    manifest.locks.push({ ...manifest.locks[0], path: 'package-lock-copy.json' })
    manifest.artifact.identity = identityFor(manifest)
    fs.writeFileSync(paths.manifest, JSON.stringify(manifest))
    expectFailure(() => verify(paths), 'Duplicate lock name')
  })

  it('includes untracked source in automatic dirty detection', () => {
    const source = fs.readFileSync(createScript, 'utf8')
    expect(source).not.toContain('--untracked-files=no')
  })

  it('fails closed on subject, dirty marker, lock, and manifest identity drift', () => {
    const paths = fixture()
    create(paths)
    expectFailure(() => verify(paths, ['--subject', 'b'.repeat(40)]), 'Subject SHA mismatch')
    expectFailure(() => verify(paths, ['--dirty', 'true']), 'Dirty marker mismatch')
    fs.writeFileSync(paths.lock, '{"lockfileVersion":2}\n')
    expectFailure(() => verify(paths), 'Lock hash mismatch')

    const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'))
    manifest.artifact.identity = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(paths.manifest, JSON.stringify(manifest))
    expectFailure(() => verify(paths), 'Artifact identity mismatch')
  })

  it('wires verified bytes into Docker and Electron without changing source-build default', () => {
    const dockerfile = fs.readFileSync(path.join(repo, 'Dockerfile'), 'utf8')
    const dockerignore = fs.readFileSync(path.join(repo, '.dockerignore'), 'utf8')
    const electron = fs.readFileSync(path.join(repo, 'electron-builder.yml'), 'utf8')

    expect(dockerfile).toContain('FROM runtime AS production-prebuilt')
    expect(dockerfile).toContain('COPY .tmp/ci-client-artifact/')
    expect(dockerfile).toContain('node scripts/ci/verify-client-dist-manifest.mjs')
    expect(dockerfile.trimEnd()).toMatch(/FROM runtime AS production[\s\S]*npm run build|FROM runtime AS production[\s\S]*source-client/)
    expect(dockerignore).toContain('!.tmp/ci-client-artifact/client/dist/**')
    expect(electron).toContain('beforePack: scripts/verify-runtime-closure.js')
    expect(electron).toContain('from: client-dist-manifest.json')
    expect(electron).not.toMatch(/\b(?:npm run build|vite build)\b/)
  })
})
