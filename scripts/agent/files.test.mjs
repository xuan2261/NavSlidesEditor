import { mkdtemp, rm, writeFile, readFile, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readLocalFile, writeLocalFile } from './files.mjs'

let root
let outside
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'navslides-agent-files-'))
  outside = await mkdtemp(path.join(os.tmpdir(), 'navslides-agent-outside-'))
  vi.stubEnv('NAVSLIDES_WORKSPACE', root)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
  await rm(outside, { recursive: true, force: true })
})

describe('agent authorized local files', () => {
  it('rejects lexical traversal and absolute paths outside the approved workspace', async () => {
    await writeFile(path.join(outside, 'private.json'), 'private')
    await expect(readLocalFile('../private.json')).rejects.toMatchObject({ code: 'INVALID_PATH' })
    await expect(readLocalFile(path.join(outside, 'private.json'))).rejects.toMatchObject({ code: 'PATH_OUTSIDE_WORKSPACE' })
  })

  it('preserves an existing export unless overwrite is explicitly authorized', async () => {
    await writeFile(path.join(root, 'deck.html'), 'old')
    await expect(writeLocalFile('deck.html', 'new')).rejects.toMatchObject({ code: 'FILE_EXISTS' })
    expect(await readFile(path.join(root, 'deck.html'), 'utf8')).toBe('old')
    await writeLocalFile('deck.html', 'new', { overwrite: true })
    expect(await readFile(path.join(root, 'deck.html'), 'utf8')).toBe('new')
  })

  it('rejects symlinked output parents outside the approved workspace', async () => {
    await symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(writeLocalFile('escape/private.json', 'blocked')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_WORKSPACE' })
  })

  it('enforces read-only mode even if overwrite is requested', async () => {
    await writeFile(path.join(root, 'deck.html'), 'keep')
    await expect(writeLocalFile('deck.html', 'replace', { overwrite: true, readOnly: true })).rejects.toMatchObject({ code: 'READ_ONLY' })
    expect(await readFile(path.join(root, 'deck.html'), 'utf8')).toBe('keep')
  })

  it('rejects a cancelled write before creating a file', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(writeLocalFile('cancelled.html', 'blocked', { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' })
    await expect(readFile(path.join(root, 'cancelled.html'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
