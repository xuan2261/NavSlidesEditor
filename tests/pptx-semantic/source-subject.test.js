import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { implementationDigest } from '../../scripts/ci/pptx-semantic-source-subject.mjs'

let root
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'pptx-semantic-subject-'))
  for (const directory of [
    'client/src',
    'client/public',
    'server/services',
    'server/routes',
    'server/middleware',
    'shared/src',
    'scripts/ci',
    'tests',
    'config',
  ]) {
    await mkdir(path.join(root, directory), { recursive: true })
  }
  for (const file of [
    'package.json',
    'package-lock.json',
    'runtime-versions.json',
    'server/middleware/schemas.js',
    'client/vite.config.js',
  ]) {
    await writeFile(path.join(root, file), '{}')
  }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('semantic verification source snapshot', () => {
  it.each([
    'client/src/layout.css',
    'tests/editability.test.js',
    'config/viewport.json',
    'client/public/font.ttf',
    'client/vite.config.js',
    'runtime-versions.json',
  ])('invalidates stale evidence when %s changes', async (file) => {
    await writeFile(path.join(root, file), 'first source bytes')
    const first = await implementationDigest(root)
    await writeFile(path.join(root, file), 'different source bytes')
    expect(await implementationDigest(root)).not.toBe(first)
  })
  it('does not bind an absolute machine path into equivalent source snapshots', async () => {
    const first = await implementationDigest(root)
    const another = await mkdtemp(path.join(tmpdir(), 'pptx-semantic-subject-copy-'))
    try {
      for (const directory of [
        'client/src',
        'client/public',
        'server/services',
        'server/routes',
        'server/middleware',
        'shared/src',
        'scripts/ci',
        'tests',
        'config',
      ]) {
        await mkdir(path.join(another, directory), { recursive: true })
      }
      for (const file of [
        'package.json',
        'package-lock.json',
        'runtime-versions.json',
        'server/middleware/schemas.js',
        'client/vite.config.js',
      ]) {
        await writeFile(path.join(another, file), '{}')
      }
      expect(await implementationDigest(another)).toBe(first)
    } finally {
      await rm(another, { recursive: true, force: true })
    }
  })
})
