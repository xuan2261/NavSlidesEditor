import { describe, expect, it, vi } from 'vitest'
import exportModule from './validated-edited-export.js'

const {
  SCHEMA_VERSION,
  createEmptyState,
  hashRecord,
  validateState,
} = await import('./pptx-import/package-store/schemas.js')
const {
  configuredLauncherClient, createQualifiedValidators, editedExportAvailability, productionComposition,
} = exportModule

function authorityState(generation, head, mutationResults) {
  const state = createEmptyState(1)
  state.generation = generation
  state.heads = [head]
  state.mutationResults = mutationResults
  validateState(state)
  return state
}

describe('validated edited export validators', () => {
  it('creates the production launcher client only from a fully pinned configuration', () => {
    const createClient = vi.fn(() => ({ run: vi.fn() }))
    const client = configuredLauncherClient({
      env: {
        OFFICECLI_LAUNCHER_PATH: 'C:\\private\\officecli-containment-launcher.exe',
        OFFICECLI_LAUNCHER_SHA256: 'aabbcc',
        OFFICECLI_LAUNCHER_VERSION: '1.0.0',
        OFFICECLI_CONTAINMENT_POLICY_DIGEST: 'policy-sha',
      },
      createClient,
    })
    expect(client).toEqual(expect.objectContaining({ run: expect.any(Function) }))
    expect(createClient).toHaveBeenCalledWith({
      launcherPath: 'C:\\private\\officecli-containment-launcher.exe',
      launcherIdentity: { sha256: 'AABBCC', version: '1.0.0' },
      policyDigest: 'policy-sha',
    })
    expect(configuredLauncherClient({ env: {}, createClient })).toBeNull()
  })

  it('requires native re-import and adds OfficeCLI only through a gateway factory', async () => {
    expect(createQualifiedValidators()).toEqual({})
    const nativeReimport = vi.fn(async () => true)
    const validators = createQualifiedValidators({ nativeReimport, officeCliGatewayFactory: () => ({
      probeCapability: async () => ({ available: true, validation: true }),
      validatePackage: async () => ({ ok: true }),
    }) })
    expect(validators.nativeReimport).toBe(nativeReimport)
    await expect(validators.officeCli({ afterBytes: Buffer.from('bytes') })).resolves.toBe(false)
  })

  it('admits a server-proven no-op reconciliation without external validators', async () => {
    const presentationId = 'deck'
    const revisionId = 'r0'
    const committedProjection = { id: presentationId, slides: [] }
    const committedSourceMap = {
      schemaVersion: 1,
      presentationId,
      revisionId,
      packageGeneration: 1,
      entries: {},
    }
    const pendingProjection = { id: presentationId, slides: [] }
    const pendingSourceMap = {
      schemaVersion: 1,
      presentationId,
      revisionId,
      packageGeneration: 2,
      entries: {},
    }
    const pendingJournalHash = hashRecord({ baseRevisionId: revisionId, operations: [] })
    const state = authorityState(2, {
      schemaVersion: SCHEMA_VERSION,
      presentationId,
      packageRevisionId: revisionId,
      originalRevisionId: revisionId,
      generation: 2,
      projectionRevisionId: hashRecord(pendingProjection),
      sourceMapRevisionId: hashRecord(pendingSourceMap),
      journalRevisionId: pendingJournalHash,
      pendingJournalHash,
      fencingEpoch: 1,
      matrixAuthorityEpoch: 1,
    }, [
      {
        schemaVersion: SCHEMA_VERSION,
        operation: 'package-import',
        presentationId,
        idempotencyKey: 'import-deck',
        packageRevisionId: revisionId,
        state: 'committed',
        generation: 1,
        operationIds: [],
        sourceMap: committedSourceMap,
        projection: committedProjection,
      },
      {
        schemaVersion: SCHEMA_VERSION,
        operation: 'projection-save',
        presentationId,
        idempotencyKey: 'save-deck',
        requestHash: hashRecord({ presentationId, revisionId, generation: 2 }),
        packageRevisionId: revisionId,
        state: 'pending-edited-export',
        generation: 2,
        operationIds: [],
        sourceMap: pendingSourceMap,
        projection: pendingProjection,
        journal: {
          baseRevisionId: revisionId,
          journalHash: pendingJournalHash,
          operations: [],
        },
      },
    ])

    await expect(editedExportAvailability({ id: presentationId }, {
      store: { getState: () => state },
    })).resolves.toMatchObject({
      available: true,
      noOp: true,
      requiresValidators: false,
    })
  })

  it('accepts legacy committed authority and fails closed on store errors', async () => {
    const presentationId = 'deck'
    const revisionId = 'r1'
    const projection = { id: presentationId, slides: [] }
    const sourceMap = {
      schemaVersion: 1,
      presentationId,
      revisionId,
      packageGeneration: 1,
      entries: {},
    }
    const state = authorityState(1, {
      schemaVersion: SCHEMA_VERSION,
      presentationId,
      packageRevisionId: revisionId,
      originalRevisionId: revisionId,
      generation: 1,
      projectionRevisionId: hashRecord(projection),
      sourceMapRevisionId: hashRecord(sourceMap),
      journalRevisionId: null,
      fencingEpoch: 1,
      matrixAuthorityEpoch: 1,
    }, [{
      schemaVersion: SCHEMA_VERSION,
      presentationId,
      idempotencyKey: 'legacy-deck',
      packageRevisionId: revisionId,
      state: 'committed',
      generation: 1,
      operationIds: [],
      sourceMap,
      projection,
      journal: {
        baseRevisionId: revisionId,
        journalHash: hashRecord({ baseRevisionId: revisionId, operations: [] }),
        operations: [],
      },
    }])
    const available = await editedExportAvailability({ id: presentationId }, {
      store: { getState: () => state },
      nativeReimport: async () => true,
      officeCliGatewayFactory: () => ({
        probeCapability: async () => ({ available: true, validation: true }),
      }),
    })
    expect(available).toMatchObject({ available: true, officeCliAvailable: true })

    const unavailable = await editedExportAvailability({ id: 'deck' }, {
      store: { getState: () => { throw new Error('store unavailable') } },
    })
    expect(unavailable).toMatchObject({
      available: false, officeCliAvailable: false,
      reasonCode: 'validated-edited-export-unavailable',
    })
  })

  it('composes the production importer for native semantic re-import', () => {
    const composition = productionComposition({
      env: {},
      importer: vi.fn(),
    })
    expect(composition.nativeReimport).toEqual(expect.any(Function))
  })
})
