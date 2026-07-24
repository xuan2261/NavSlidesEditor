import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import validatorModule from './native-reimport-validator.js'

const { createNativeReimportValidator } = validatorModule
const workspaces = []

function sourceRef(overrides = {}) {
  return {
    revisionId: 'r0',
    packageGeneration: 1,
    partUri: 'ppt/slides/slide1.xml',
    nativeId: '4',
    kind: 'text-run',
    relationshipChain: ['_rels/.rels', 'ppt/_rels/presentation.xml.rels'],
    groupAncestry: [],
    occurrencePath: [0],
    sourceHash: 'a'.repeat(64),
    matchMethod: 'native-id',
    confidence: 1,
    status: 'authoritative',
    ...overrides,
  }
}

function context(after = 'After') {
  return {
    afterBytes: Buffer.from('pptx-bytes'),
    presentationId: 'deck',
    revisionId: 'r0',
    packageGeneration: 1,
    journal: {
      operations: [{
        slideId: 's1',
        elementId: 'e1',
        rowId: 'primitive.text.run.plain-replacement',
        objectKind: 'text-run',
        after,
        sourceRef: sourceRef(),
      }],
    },
  }
}

function importedProjection(content = '<p>After</p>') {
  return {
    presentation: {
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content }] }],
    },
    sourceMap: {
      presentationId: 'deck',
      revisionId: 'r0',
      packageGeneration: 1,
      entries: { 's1:e1': sourceRef() },
    },
  }
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })))
})

describe('native re-import workspace containment', () => {
  it('accepts a missing nested workspace under the canonical temp root', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-parent-'))
    const workspaceRoot = path.join(tempRoot, 'nested', 'workspace')
    workspaces.push(tempRoot)
    const importer = vi.fn(async () => importedProjection())
    const validate = createNativeReimportValidator({ importer, workspaceRoot })

    await expect(validate(context())).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
    expect(await fs.readdir(tempRoot)).toEqual(['nested'])
  })

  it('rejects a quarantine root outside the private workspace', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    const quarantineRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-quarantine-'))
    workspaces.push(workspaceRoot, quarantineRoot)
    const importer = vi.fn(async () => importedProjection())
    const validate = createNativeReimportValidator({ importer, workspaceRoot, quarantineRoot })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_QUARANTINE_UNSAFE',
    })
    expect(importer).not.toHaveBeenCalled()
    expect(await fs.readdir(quarantineRoot)).toEqual([])
  })

  it('rejects a reparse-point workspace root before staging', async ({ skip }) => {
    const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-target-'))
    const linkParent = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-link-'))
    const workspaceRoot = path.join(linkParent, 'workspace-link')
    workspaces.push(targetRoot, linkParent)
    try {
      await fs.symlink(targetRoot, workspaceRoot, process.platform === 'win32' ? 'junction' : 'dir')
    } catch (error) {
      if (['EACCES', 'EPERM', 'ENOSYS'].includes(error?.code)) return skip()
      throw error
    }
    const importer = vi.fn(async () => importedProjection())
    const validate = createNativeReimportValidator({ importer, workspaceRoot })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_WORKSPACE_UNSAFE',
    })
    expect(importer).not.toHaveBeenCalled()
    expect(await fs.readdir(targetRoot)).toEqual([])
  })

  it('rejects an intermediate reparse-point workspace component', async ({ skip }) => {
    const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-target-'))
    const linkParent = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-link-'))
    const redirect = path.join(linkParent, 'redirect')
    const workspaceRoot = path.join(redirect, 'workspace')
    workspaces.push(targetRoot, linkParent)
    try {
      await fs.symlink(targetRoot, redirect, process.platform === 'win32' ? 'junction' : 'dir')
      await fs.mkdir(path.join(targetRoot, 'workspace'))
    } catch (error) {
      if (['EACCES', 'EPERM', 'ENOSYS'].includes(error?.code)) return skip()
      throw error
    }
    const importer = vi.fn(async () => importedProjection())
    const validate = createNativeReimportValidator({ importer, workspaceRoot })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_WORKSPACE_UNSAFE',
    })
    expect(importer).not.toHaveBeenCalled()
    expect(await fs.readdir(path.join(targetRoot, 'workspace'))).toEqual([])
  })

  it('preserves a primary validation failure when cleanup and quarantine both fail', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const remove = vi.spyOn(fs, 'rm').mockImplementationOnce(async () => {
      throw new Error('cleanup denied')
    })
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('file locked'))
    const validate = createNativeReimportValidator({
      importer: async () => importedProjection('<p>Wrong</p>'),
      workspaceRoot,
    })

    try {
      await expect(validate(context())).rejects.toMatchObject({
        code: 'NATIVE_REIMPORT_SEMANTIC_MISMATCH',
        cleanupCode: 'NATIVE_REIMPORT_CLEANUP_FAILED',
      })
    } finally {
      remove.mockRestore()
      rename.mockRestore()
    }
  })
})
