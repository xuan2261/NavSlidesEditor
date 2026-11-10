// Task23 authority fencing: malformed, future, cyclic, and injected authority rejection on saves and imports.
import { createRequire } from 'node:module'
import { expect } from 'vitest'
import { assertRejectedSemanticArchive } from './task23-archive-admission.js'

const require = createRequire(import.meta.url)

export async function assertSaveAuthorityRejection({ current, initialId, read, save, originalFor }) {
  const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document.js')
  const cycled = structuredClone(await read(initialId)).pptxSemantic
  const def = Object.values(cycled.definitions)[0]
  def.content.circular = def.content
  expect(() => normalizePptxSemanticDocument(cycled)).toThrowError(
    expect.objectContaining({ code: 'INVALID_PPTX_SEMANTIC_DOCUMENT' })
  )

  const advanced = await save(await read(initialId), 'task23-advance-save-generation')
  expect(advanced.status, JSON.stringify(advanced.body)).toBe(200)
  expect(advanced.body.aggregateGeneration).toBeGreaterThanOrEqual(1)

  const cases = [
    'future',
    'missing-definition',
    'cyclic-parent',
    'injected-authority',
    'source-baseline',
    'stale-forward',
    'stale-backward',
  ]

  for (const failure of cases) {
    const before = await read(initialId)
    const invalid = structuredClone(before)
    const instance = Object.values(invalid.pptxSemantic.instances)[0]

    if (failure === 'future') invalid.pptxSemantic.schemaVersion = 99
    if (failure === 'missing-definition') instance.definitionId = 'absent'
    if (failure === 'cyclic-parent') instance.parentInstanceId = instance.id
    if (failure === 'injected-authority') {
      instance.overrides.adapterQualified = true
    }
    if (failure === 'source-baseline') {
      invalid.pptxSemantic.definitions[instance.definitionId].source.preconditionHash = '0'.repeat(64)
    }
    if (failure === 'stale-forward') invalid.aggregateGeneration = before.aggregateGeneration + 99
    if (failure === 'stale-backward') invalid.aggregateGeneration = before.aggregateGeneration - 1

    const denied = await save(invalid, `invalid-${failure}`)
    const isStale = failure.startsWith('stale')
    expect(denied.status, JSON.stringify(denied.body)).toBe(isStale ? 409 : 400)
    if (isStale) {
      expect(denied.body.code).toBe('STALE_GENERATION')
    }

    const after = await read(initialId)
    expect(after.aggregateGeneration).toBe(before.aggregateGeneration)
    expect(after.pptxSemantic).toEqual(before.pptxSemantic)

    await current.runtime.shutdownPackageStore()
    current.store = await current.runtime.initializePackageStore({ rootDir: current.storage.DATA_DIR })
    expect((await read(initialId)).pptxSemantic).toEqual(before.pptxSemantic)
    await originalFor(initialId)
  }
}

export async function assertArchivePreflightAuthorityRejection({ current, initial, read, originalFor }) {
  for (const failure of ['future', 'missing-definition', 'cyclic', 'authority']) {
    await assertRejectedSemanticArchive({ current, initial, read, originalFor, failure })
  }
}

export async function assertPortableSourceMapAuthorityRejection({ current, initialId, read, originalFor }) {
  const before = await read(initialId)
  const bundle = await current.store.exportPresentationPackage(initialId)
  const { hashRecord } = require('../../server/services/pptx-import/package-store/schemas')
  const result = bundle.manifest.mutationResults[0]
  result.sourceMap.schemaVersion = 99
  bundle.manifest.head.sourceMapRevisionId = hashRecord(result.sourceMap)
  const head = current.store.getState().heads.find((value) => value.presentationId === initialId)

  await expect(
    current.runtime.withPackageStore((store) =>
      store.importPresentationPackage(bundle, initialId, { replace: true, expectedHead: head })
    )
  ).rejects.toMatchObject({ code: 'PACKAGE_AUTHORITY_UNAVAILABLE' })

  expect((await read(initialId)).pptxSemantic).toEqual(before.pptxSemantic)
  expect((await read(initialId)).aggregateGeneration).toBe(before.aggregateGeneration)
  await originalFor(initialId)
}
