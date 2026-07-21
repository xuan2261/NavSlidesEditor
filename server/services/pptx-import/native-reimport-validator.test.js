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
        sourceMapIdentity: {
          presentationId: 'deck',
          revisionId: 'r0',
          packageGeneration: 1,
        },
      })
      expect(options.uploadsDir).toContain(workspaceRoot)
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

  it('rejects a re-import whose authoritative text does not match the journal', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'native-reimport-test-'))
    workspaces.push(workspaceRoot)
    const validate = createNativeReimportValidator({
      importer: async () => importedProjection('<p>Wrong</p>'),
      workspaceRoot,
    })

    await expect(validate(context())).rejects.toMatchObject({
      code: 'NATIVE_REIMPORT_SEMANTIC_MISMATCH',
    })
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
