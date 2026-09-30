import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { captureSourceFingerprint } from './baseline-support.mjs'

const repositories = []

function git(repo, ...args) {
  execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' })
}

function createRepository() {
  const repo = mkdtempSync(join(tmpdir(), 'navslides-baseline-'))
  repositories.push(repo)
  git(repo, 'init', '--quiet')
  writeFileSync(join(repo, '.gitattributes'), '*.txt text eol=lf\n')
  writeFileSync(join(repo, 'content.txt'), 'first\nsecond\n')
  writeFileSync(join(repo, 'stable.txt'), 'stable\n')
  git(repo, 'add', '.gitattributes', 'content.txt', 'stable.txt')
  return repo
}

afterEach(() => {
  for (const repo of repositories.splice(0)) {
    rmSync(repo, { recursive: true, force: true })
  }
})

describe('source fingerprint', () => {
  it('hashes Git clean-filtered blobs instead of working-tree line endings', () => {
    const repo = createRepository()
    const lf = captureSourceFingerprint(repo)

    writeFileSync(join(repo, 'content.txt'), 'first\r\nsecond\r\n')

    expect(captureSourceFingerprint(repo)).toEqual(lf)
  })

  it('changes for semantic edits and tracked-file deletions', () => {
    const repo = createRepository()
    const original = captureSourceFingerprint(repo)

    writeFileSync(join(repo, 'content.txt'), 'first\nchanged\n')
    const edited = captureSourceFingerprint(repo)
    unlinkSync(join(repo, 'stable.txt'))
    const deleted = captureSourceFingerprint(repo)

    expect(edited.fileCount).toBe(original.fileCount)
    expect(edited.hash).not.toBe(original.hash)
    expect(deleted.fileCount).toBe(original.fileCount)
    expect(deleted.hash).not.toBe(original.hash)
    expect(deleted.hash).not.toBe(edited.hash)
  })
})
