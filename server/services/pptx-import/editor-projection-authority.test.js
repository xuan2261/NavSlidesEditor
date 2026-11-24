import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import authority from './package-authority-snapshot.js'
import schemas from './package-store/schemas.js'
import journalModule from './mutation-journal.js'
import matrix from './canonical-feature-matrix.js'
import sourceMaps from './source-map.js'
import editedExport from '../validated-edited-export.js'
import planner from './transactional-patch-planner.js'

const { hashRecord } = schemas
function fixture() {
  const projection = { id: 'deck', title: 'Imported', slides: [{ id: 'slide', elements: [] }] }
  const sourceMap = sourceMaps.createSourceMap({
    presentationId: 'deck',
    revisionId: 'r0',
    packageGeneration: 1,
    entries: {},
  })
  const imported = {
    operation: 'package-import',
    state: 'committed',
    presentationId: 'deck',
    packageRevisionId: 'r0',
    generation: 1,
    projection,
    sourceMap,
  }
  const state = { matrixAuthorityEpoch: 1, heads: [], mutationResults: [imported] }
  let before = imported
  for (const generation of [2, 3]) {
    const after = {
      ...before.projection,
      title: `Saved ${generation}`,
      interactionVariables: [{ id: 'score', name: 'Score', min: 0, initialValue: 0, max: 10 }],
    }
    const journal = journalModule.deriveMutationJournal(before.projection, after, {
      baseRevisionId: 'r0',
      sourceMap: before.sourceMap,
      matrixAuthorityEpoch: 1,
    })
    before = {
      operation: 'projection-save',
      state: 'pending-edited-export',
      presentationId: 'deck',
      packageRevisionId: 'r0',
      generation,
      projection: after,
      sourceMap: sourceMaps.rebindSourceMap(sourceMap, {
        presentationId: 'deck',
        revisionId: 'r0',
        packageGeneration: generation,
      }),
      journal,
      operationIds: journal.operations.map((item) => item.operationId),
    }
    state.mutationResults.push(before)
  }
  state.heads.push({
    presentationId: 'deck',
    packageRevisionId: 'r0',
    generation: 3,
    matrixAuthorityEpoch: 1,
    matrixAuthoritySubjects: matrix.createMatrixAuthoritySubjects(),
    projectionRevisionId: hashRecord(before.projection),
    sourceMapRevisionId: hashRecord(before.sourceMap),
    journalRevisionId: before.journal.journalHash,
    pendingJournalHash: before.journal.journalHash,
  })
  return state
}

describe('editor projection authority distinct from native export eligibility', () => {
  it('reads successive accepted metadata saves anchored to the imported package without qualifying native export', async () => {
    const state = fixture()
    const result = authority.resolveEditorProjectionContext(state, 'deck')
    expect(result).toMatchObject({
      ok: true,
      after: { title: 'Saved 3', interactionVariables: [{ id: 'score' }] },
    })
    expect(result.after).toEqual(state.mutationResults[2].projection)
    expect(result.sourceMap).toEqual(state.mutationResults[2].sourceMap)
    const refused = await editedExport.executeValidatedEditedExport({
      presentationId: 'deck', expectedGeneration: 3, idempotencyKey: 'metadata-export',
    }, { store: { getState: () => state } })
    expect(refused).toMatchObject({
      ok: false, status: 422, blockReason: 'CANONICAL_TEXT_JOURNAL_INVALID',
    })
  })

  it('reads the head-bound committed import projection without borrowing pending editor state', () => {
    const state = fixture()
    const imported = state.mutationResults[0]
    state.mutationResults = [imported]
    Object.assign(state.heads[0], {
      generation: 1,
      projectionRevisionId: hashRecord(imported.projection),
      sourceMapRevisionId: hashRecord(imported.sourceMap),
      journalRevisionId: null,
    })
    delete state.heads[0].pendingJournalHash
    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: true,
      after: imported.projection,
    })
  })

  it('requires committed native journal contents to match its retained head hash', () => {
    const state = structuredClone(fixture())
    const committed = state.mutationResults[0]
    committed.operation = 'validated-edited-export'
    committed.journal = journalModule.deriveCanonicalPlainTextJournal(
      committed.projection,
      committed.projection,
      {
        baseRevisionId: 'previous-package',
        sourceMap: committed.sourceMap,
        matrixAuthorityEpoch: 1,
      }
    )
    committed.operationIds = []
    state.mutationResults = [committed]
    Object.assign(state.heads[0], {
      generation: 1,
      projectionRevisionId: hashRecord(committed.projection),
      sourceMapRevisionId: hashRecord(committed.sourceMap),
      journalRevisionId: committed.journal.journalHash,
    })
    delete state.heads[0].pendingJournalHash
    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: true,
      after: committed.projection,
    })
    committed.journal = { ...committed.journal, metadata: { requestHash: 'a'.repeat(64) } }
    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: false,
      reasonCode: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    })
  })

  it.each([
    [
      'projection hash',
      (state) => {
        state.heads[0].projectionRevisionId = 'a'.repeat(64)
      },
    ],
    [
      'source map hash',
      (state) => {
        state.heads[0].sourceMapRevisionId = 'a'.repeat(64)
      },
    ],
    [
      'generation',
      (state) => {
        state.heads[0].generation = 4
      },
    ],
    [
      'presentation identity',
      (state) => {
        state.mutationResults[2].projection.id = 'foreign'
        state.heads[0].projectionRevisionId = hashRecord(state.mutationResults[2].projection)
      },
    ],
    [
      'source revision identity',
      (state) => {
        state.mutationResults[2].sourceMap.revisionId = 'foreign'
        state.heads[0].sourceMapRevisionId = hashRecord(state.mutationResults[2].sourceMap)
      },
    ],
    [
      'source generation identity',
      (state) => {
        state.mutationResults[2].sourceMap.packageGeneration = 2
        state.heads[0].sourceMapRevisionId = hashRecord(state.mutationResults[2].sourceMap)
      },
    ],
    [
      'journal pointer',
      (state) => {
        state.heads[0].journalRevisionId = 'a'.repeat(64)
      },
    ],
    [
      'journal contents',
      (state) => {
        state.mutationResults[2].journal.operations.push({ kind: 'slide-delete', slideId: 'slide' })
      },
    ],
    [
      'operation IDs',
      (state) => {
        state.mutationResults[2].operationIds = ['invented']
      },
    ],
    [
      'operation authority',
      (state) => {
        state.mutationResults[2].operation = 'package-import'
      },
    ],
    [
      'duplicate authority',
      (state) => {
        state.mutationResults.push(structuredClone(state.mutationResults[2]))
      },
    ],
    [
      'conflicting generation authority',
      (state) => {
        state.mutationResults.push({
          ...state.mutationResults[2],
          projection: { ...state.mutationResults[2].projection, title: 'Conflicting' },
        })
      },
    ],
    [
      'journal base revision',
      (state) => {
        state.mutationResults[2].journal.baseRevisionId = 'foreign'
      },
    ],
    [
      'missing package anchor',
      (state) => {
        state.mutationResults.shift()
      },
    ],
  ])('fails closed for %s instead of selecting a stale projection', (_name, change) => {
    const state = structuredClone(fixture())
    change(state)
    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: false,
      reasonCode: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    })
  })
  it('keeps hash-bound historical pending edits readable without granting current native authority', () => {
    const state = fixture()
    const pending = state.mutationResults[2]
    const originalJournalHash = hashRecord(pending.journal)
    state.matrixAuthorityEpoch = 2
    Object.assign(state.heads[0], {
      matrixAuthorityEpoch: 2,
      matrixAuthoritySubjects: matrix.createMatrixAuthoritySubjects(undefined, 2),
    })

    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: true,
      after: pending.projection,
      pendingJournalHash: pending.journal.journalHash,
    })
    expect(hashRecord(pending.journal)).toBe(originalJournalHash)
    expect(planner.compilePatchPlan(pending.journal, { matrixAuthorityEpoch: 2 }))
      .toMatchObject({ ok: false, reasonCode: 'JOURNAL_MATRIX_AUTHORITY_SUBJECT_STALE' })
  })

  it.each([false, true])('rejects future pending journal epochs with rewritten head pointers=%s', (rewritePointers) => {
    const state = fixture()
    const previous = state.mutationResults[1]
    const pending = state.mutationResults[2]
    state.matrixAuthorityEpoch = 2
    Object.assign(state.heads[0], {
      matrixAuthorityEpoch: 2,
      matrixAuthoritySubjects: matrix.createMatrixAuthoritySubjects(undefined, 2),
    })
    pending.journal = journalModule.deriveMutationJournal(previous.projection, pending.projection, {
      baseRevisionId: state.heads[0].packageRevisionId,
      sourceMap: previous.sourceMap,
      matrixAuthorityEpoch: 3,
    })
    pending.operationIds = pending.journal.operations.map((operation) => operation.operationId)
    if (rewritePointers) {
      state.heads[0].journalRevisionId = pending.journal.journalHash
      state.heads[0].pendingJournalHash = pending.journal.journalHash
    }

    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: false,
      reasonCode: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    })
  })

  it.each([undefined, null, 0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1])(
    'rejects malformed historical journal epoch %s without a live-epoch fallback', (epoch) => {
      const state = structuredClone(fixture())
      state.mutationResults[2].journal.matrixAuthoritySubject.evolutionEpoch = epoch
      expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
        ok: false,
        reasonCode: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      })
    }
  )

  it('rejects a missing historical matrix authority subject', () => {
    const state = structuredClone(fixture())
    delete state.mutationResults[2].journal.matrixAuthoritySubject
    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: false,
      reasonCode: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
    })
  })


  it('rejects a stale feature matrix authority even when projection hashes match', () => {
    const state = fixture()
    state.matrixAuthorityEpoch = 2
    expect(authority.resolveEditorProjectionContext(state, 'deck')).toMatchObject({
      ok: false,
      reasonCode: 'STALE_MATRIX_AUTHORITY',
    })
  })

  it.each(['original', 'current'])('rejects corrupt owned %s package bytes', async (corrupted) => {
    const bytes = { original: Buffer.from('original'), current: Buffer.from('current') }
    const head = {
      presentationId: 'deck',
      originalRevisionId: 'original',
      packageRevisionId: 'current',
    }
    const revisions = Object.entries(bytes).map(([id, value]) => ({
      id,
      blobSha256: crypto.createHash('sha256').update(value).digest('hex'),
    }))
    const store = {
      getState: () => ({
        heads: [head],
        revisions,
        owners: revisions.map((revision) => ({
          ownerType: 'presentation',
          ownerId: 'deck',
          revisionId: revision.id,
        })),
      }),
      readBlob: async (hash) => {
        const revision = revisions.find((item) => item.blobSha256 === hash)
        return revision.id === corrupted ? Buffer.from('corrupt') : bytes[revision.id]
      },
    }
    await expect(authority.verifyEditorPackageBytes(store, head)).rejects.toMatchObject({
      code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      status: 422,
    })
  })
})
