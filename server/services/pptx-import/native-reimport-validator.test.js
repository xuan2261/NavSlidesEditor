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

function context(after = 'After', overrides = {}) {
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
        sourceRef: sourceRef(overrides),
      }],
    },
  }
}

function importedProjection(content = '<p>After</p>', entry = {}) {
  return {
    presentation: {
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content }] }],
    },
    sourceMap: {
      presentationId: 'deck',
      revisionId: 'r0',
      packageGeneration: 1,
      entries: {
        's1:e1': {
          ...sourceRef(),
          ...entry,
        },
      },
    },
  }
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })))
})

describe('production native re-import validator', () => {
  it('imports the staged package through the production importer and compares source identity', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const importer = vi.fn(async (filePath, options) => {
      expect(filePath).toMatch(/edited-export\.pptx$/)
      expect(options).toMatchObject({
        originalName: 'edited-export.pptx',
        strict: true,
        strictCountGate: true,
        strictNodeGate: true,
        mediaTransaction: { hashScope: {} },
        sourceMapIdentity: {
          presentationId: 'deck',
          revisionId: 'r0',
          packageGeneration: 1,
        },
      })
      expect(await fs.realpath(options.uploadsDir)).toContain(await fs.realpath(workspaceRoot))
      expect((await fs.readFile(filePath)).equals(Buffer.from('pptx-bytes'))).toBe(true)
      return importedProjection()
    })
    const validate = createNativeReimportValidator({ importer, workspaceRoot })

    await expect(validate(context())).resolves.toBe(true)
    expect(importer).toHaveBeenCalledOnce()
    expect(await fs.readdir(workspaceRoot)).toEqual([])
  })

  it('accepts a changed post-edit source hash when stable provenance matches', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const validate = createNativeReimportValidator({
      importer: async () => importedProjection('<p>After</p>', {
        sourceHash: 'b'.repeat(64),
      }),
      workspaceRoot,
    })

    await expect(validate(context())).resolves.toBe(true)
  })

  it('quarantines the staged job when cleanup fails', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const remove = vi.spyOn(fs, 'rm').mockImplementationOnce(async () => {
      throw new Error('cleanup denied')
    })
    const validate = createNativeReimportValidator({
      importer: async () => importedProjection(),
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_CLEANUP_QUARANTINED',
    })
    const quarantineRoot = path.join(workspaceRoot, 'quarantine')
    const [quarantined] = await fs.readdir(quarantineRoot)
    expect(await fs.readFile(path.join(quarantineRoot, quarantined, 'edited-export.pptx')))
      .toEqual(Buffer.from('pptx-bytes'))
    remove.mockRestore()
  })

  it('preserves a validation failure when cleanup is quarantined', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const remove = vi.spyOn(fs, 'rm').mockImplementationOnce(async () => {
      throw new Error('cleanup denied')
    })
    const validate = createNativeReimportValidator({
      importer: async () => importedProjection('<p>Wrong</p>'),
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_SEMANTIC_MISMATCH',
      cleanupCode: 'NATIVE_REIMPORT_CLEANUP_QUARANTINED',
    })
    remove.mockRestore()
  })

  it('fails closed when staging cannot be removed or quarantined', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const remove = vi.spyOn(fs, 'rm').mockImplementationOnce(async () => {
      throw new Error('cleanup denied')
    })
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('file locked'))
    const validate = createNativeReimportValidator({
      importer: async () => importedProjection(),
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_CLEANUP_FAILED',
    })
    remove.mockRestore()
    rename.mockRestore()
  })

  it('closes the native media transaction before cleaning a failed validation', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    let transaction
    const validate = createNativeReimportValidator({
      importer: async (_filePath, options) => {
        transaction = options.mediaTransaction
        return importedProjection('<p>Wrong</p>')
      },
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_SEMANTIC_MISMATCH',
    })
    expect(() => transaction.record({})).toThrow('PPTX media transaction is already closed')
    expect(transaction.hashScope).toEqual({})
    expect(await fs.readdir(workspaceRoot)).toEqual([])
  })

  it('fails closed when the re-import cannot prove the source identity', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const validate = createNativeReimportValidator({
      importer: async () => ({
        presentation: { slides: [] },
        sourceMap: { presentationId: 'deck', revisionId: 'r0', packageGeneration: 1, entries: {} },
      }),
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_SOURCE_UNAVAILABLE',
    })
  })

  it('rejects a matching native id when stable provenance differs', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const validate = createNativeReimportValidator({
      importer: async () => importedProjection('<p>After</p>', {
        occurrencePath: [1],
      }),
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_PROVENANCE_MISMATCH',
    })
  })

  it('rejects ambiguous native identity candidates', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const validate = createNativeReimportValidator({
      importer: async () => ({
        presentation: {
          slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>After</p>' }] }],
        },
        sourceMap: {
          presentationId: 'deck',
          revisionId: 'r0',
          packageGeneration: 1,
          entries: {
            's1:e1': sourceRef(),
            's1:e2': sourceRef(),
          },
        },
      }),
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_SOURCE_AMBIGUOUS',
    })
  })

})
