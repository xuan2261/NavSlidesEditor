// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
const require = createRequire(import.meta.url)
const { resolvePackageBackedReadFromState } = require('../../server/services/package-backed-presentation-read')
const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')

describe('deferred compatibility semantic admission', () => {
  it('reuses owned admission but not mutable publications, and rechecks source and mutated authority', async () => {
    const { openPackageStore } = require('../../server/services/pptx-import/package-store')
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-admission-'))
    const store = await openPackageStore({ rootDir })
    await store.acquireWriter()
    try {
      const zip = new JSZip()
      zip.file('[Content_Types].xml', '<Types />')
      zip.file('ppt/presentation.xml', '<presentation />')
      const projection = { id: 'deck', title: 'Authoritative', slides: [] }
      const result = await store.commitImport(await zip.generateAsync({ type: 'nodebuffer' }), {
        jobId: 'read-test', presentationId: 'deck', projection,
        sourceMap: { entries: {} }, compatibilityPresentation: projection,
      })
      const compatibility = {
        ...projection, pptxAggregateHead: result.head,
        pptxSemantic: { schemaVersion: 99 },
      }
      const options = { getAdmittedSnapshot: store.getAuthoritativeSaveSnapshot.bind(store) }
      const { resolveEditorProjectionContext } = require('../../server/services/pptx-import/package-authority-snapshot')
      const read = () => resolvePackageBackedReadFromState(store.getOwnedAuthorityState(), 'deck', compatibility, options)
      const owned = store.getOwnedAuthorityState()
      const context = resolveEditorProjectionContext(owned, 'deck')
      expect(context.ok).toBe(true)
      expect(resolveEditorProjectionContext(store.getOwnedAuthorityState(), 'deck')).toBe(context)
      expect(() => { context.after.slides.push({ id: 'bad' }) }).toThrow()
      // A clone has no private admission receipt, even when its bytes match.
      expect(resolveEditorProjectionContext(structuredClone(owned), 'deck')).not.toBe(context)
      const root = store.metadata.root
      store.metadata.root = { ...root, transactionId: 'new-input-version' }
      expect(store.getOwnedAuthorityState()).not.toBe(owned)
      store.metadata.root = root
      const first = read()
      expect(first.presentation.pptxSemantic).toBeUndefined()
      expect(first.presentation.title).toBe('Authoritative')
      first.presentation.slides.push({ id: 'injected' })
      first.presentation.title = 'mutated'
      expect(read().presentation).toMatchObject({ title: 'Authoritative', slides: [] })
      const state = store.getState()
      state.owners = []
      expect(() => resolvePackageBackedReadFromState(state, 'deck', compatibility, options))
        .toThrow('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
      // Durable state rejects edits. Deliberately replace the internal graph
      // with unowned mutable data to exercise the exact-envelope fallback too.
      expect(() => { store.metadata.state.mutationResults[0].projection.title = 'tampered' }).toThrow()
      store.metadata.state = structuredClone(store.metadata.state)
      store.metadata.state.mutationResults[0].projection.title = 'tampered'
      expect(read).toThrow('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
      expect(context.after.title).toBe('Authoritative')
      store.metadata.state.mutationResults[0].projection.title = 'Authoritative'
      expect(read().presentation.title).toBe('Authoritative')
      const source = structuredClone(store.metadata.state.mutationResults[0].sourceMap)
      store.metadata.state.mutationResults[0].sourceMap = source
      source.entries.forged = { revisionId: 'wrong', packageGeneration: 1 }
      expect(read).toThrow('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
      delete source.entries.forged
      const authority = store.metadata.state.mutationResults[0]
      const journal = authority.journal
      authority.journal = { ...journal, journalHash: '0'.repeat(64) }
      expect(read).toThrow('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
      authority.journal = journal
      store.metadata.state.heads[0] = { ...store.metadata.state.heads[0] }
      store.metadata.state.heads[0].generation++
      expect(read).toThrow('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
    } finally {
      await store.releaseWriter()
      await fs.rm(rootDir, { recursive: true, force: true })
    }
  })
  it('reuses exact validated save receipts and fails closed after same-generation corruption or reload', async () => {
    const runtime = require('../../server/services/pptx-import/package-store-runtime')
    const { savePackageProjection } = require('../../server/services/generation-safe-save')
    const { createEditorPackageRead, resolveEditorProjectionContext } = require('../../server/services/pptx-import/package-authority-snapshot')
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'saved-reader-'))
    const store = await runtime.initializePackageStore({ rootDir: dir })
    try {
      const zip = new JSZip()
      zip.file('[Content_Types].xml', '<Types />')
      zip.file('ppt/presentation.xml', '<presentation />')
      const projection = { id: 'saved-deck', title: 'before', slides: [], packagePath: 'stripped-import-metadata' }
      const imported = await store.commitImport(await zip.generateAsync({ type: 'nodebuffer' }), {
        jobId: 'saved-read', presentationId: projection.id, projection,
        sourceMap: { entries: {} }, compatibilityPresentation: projection,
      })
      const saved = await savePackageProjection({
        presentationId: projection.id, expectedGeneration: imported.head.generation,
        idempotencyKey: 'saved-read-receipt', after: { title: 'after' }, loadStored: async () => projection,
      })
      expect(saved.ok).toBe(true)
      const context = () => resolveEditorProjectionContext(createEditorPackageRead(store).state, projection.id)
      const first = context()
      expect(first.ok).toBe(true)
      expect(first.after).toBe(saved.projection)
      expect(store.getAuthoritativeSaveSnapshot(projection.id, saved.aggregateHead)).toBe(saved.projection)
      expect(() => store.getAuthoritativeSaveSnapshot(projection.id, saved.aggregateHead, { maxStringBytes: 1 })).toThrow(/budget/)
      expect(context()).toBe(first)
      const pristine = structuredClone(store.metadata.state)
      // Equal detached raw queries may reuse the derivation, but their identity
      // must never become proof when retained callers mutate them in place.
      const raw = structuredClone(pristine)
      expect(resolveEditorProjectionContext(raw, projection.id).ok).toBe(true)
      raw.mutationResults[0].projection.title = 'mutated raw baseline'
      expect(resolveEditorProjectionContext(raw, projection.id).ok).toBe(false)
      const corruptions = [
        (state) => { state.heads[0].projectionRevisionId = '0'.repeat(64) },
        (state) => { state.mutationResults.at(-1).projection.title = 'corrupt' },
        (state) => { state.mutationResults.at(-1).sourceMap.entries.forged = { revisionId: 'wrong', packageGeneration: 2 } },
        (state) => { state.mutationResults.at(-1).journal.journalHash = '0'.repeat(64) },
        (state) => { state.mutationResults[0].projection.title = 'corrupt predecessor' },
        (state) => { state.mutationResults.at(-1).operationIds.push('forged-operation') },
        (state) => { state.mutationResults.at(-1).journal.operations[0].after = 'forged-after' },
      ]
      for (const corrupt of corruptions) {
        store.metadata.state = structuredClone(pristine)
        corrupt(store.metadata.state)
        expect(context().ok).toBe(false)
      }
      store.metadata.state = structuredClone(pristine)
      const read = createEditorPackageRead(store)
      await read.verifyBytes(saved.aggregateHead)
      const readBlob = store.readBlob
      store.readBlob = async () => Buffer.from('corrupt package bytes')
      try {
        await expect(read.verifyBytes(saved.aggregateHead)).rejects.toThrow('integrity verification')
      } finally {
        store.readBlob = readBlob
      }
      await store.reload()
      expect(context().ok).toBe(true)
      expect(context()).not.toBe(first)
    } finally {
      await runtime.shutdownPackageStore()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
  it('persists and cold-reopens a complete semantic saved deck with pending outbox', async () => {
    const { buildFeatureFixture } = await import('./feature-fixtures.js')
    const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
    const runtime = require('../../server/services/pptx-import/package-store-runtime')
    const { savePackageProjection } = require('../../server/services/generation-safe-save')
    const { resolveEditorProjectionContext } = require('../../server/services/pptx-import/package-authority-snapshot')
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cold-semantic-save-'))
    try {
      const { buffer } = await buildFeatureFixture()
      const imported = await projectSemanticImport({ zip: await JSZip.loadAsync(buffer), uploadsDir: dir,
        geometryInheritance: true, presentation: { id: 'deck', slides: ['slide1', 'slide2'].map(id => ({ id, elements: [] })) } })
      let store = await runtime.initializePackageStore({ rootDir: dir })
      const entries = Object.fromEntries(imported.presentation.slides.flatMap(slide => slide.elements.map(element => {
        const instance = imported.presentation.pptxSemantic.instances[element.pptxInstanceId]
        const definition = imported.presentation.pptxSemantic.definitions[instance.definitionId]
        return [`${slide.id}:${element.id}`, { status: 'diagnostic', packageGeneration: 1, revisionId: 'import',
          partUri: definition.source.partUri, kind: definition.kind, sourceHash: definition.source.preconditionHash,
          relationshipChain: [], groupAncestry: [], occurrencePath: [] }]
      })))
      await store.commitImport(buffer, { jobId: 'cold-import', presentationId: 'deck',
        projection: imported.presentation, sourceMap: { entries }, compatibilityPresentation: imported.presentation })
      const marker = 'persisted-semantic-marker'
      const saved = await savePackageProjection({ presentationId: 'deck', expectedGeneration: 1,
        idempotencyKey: 'cold-save', after: { title: marker }, loadStored: async () => imported.presentation })
      expect(saved.ok).toBe(true)
      await runtime.shutdownPackageStore()
      store = await runtime.initializePackageStore({ rootDir: dir })
      const state = store.getOwnedAuthorityState()
      const context = resolveEditorProjectionContext(state, 'deck')
      expect(context.ok).toBe(true)
      expect(context.head.generation).toBe(2)
      expect(context.after.title).toBe(marker)
      const { hashRecord } = require('../../server/services/pptx-import/package-store/schemas')
      expect(hashRecord(context.after.pptxSemantic)).toBe(hashRecord(saved.projection.pptxSemantic))
      expect(state.compatibilityOutbox.some(write => write.generation === 2)).toBe(true)
      await store.acknowledgeCompatibilityWrites(store.getCompatibilityState().compatibilityOutbox)
      await runtime.shutdownPackageStore()
      store = await runtime.initializePackageStore({ rootDir: dir })
      expect(store.getCompatibilityState().compatibilityOutbox).toEqual([])
      expect(resolveEditorProjectionContext(store.getOwnedAuthorityState(), 'deck').after.title).toBe(marker)
    } finally {
      await runtime.shutdownPackageStore()
      await fs.rm(dir, { recursive: true, force: true })
    }
  }, 15000) // Three durable writer lifecycles; not the startup recovery deadline.
  it('keeps malformed no-authority fallback subject to semantic validation', () => {
    const stored = { id: 'plain', slides: [], pptxSemantic: { schemaVersion: 99 } }
    const resolved = resolvePackageBackedReadFromState({ heads: [] }, 'plain', stored)
    expect(() => normalizePptxSemanticDocument(resolved.presentation.pptxSemantic)).toThrow()
    expect(resolved.presentation).not.toBe(stored)
  })
  it('does not bypass missing head with malformed unused compatibility semantics', () => {
    expect(() => resolvePackageBackedReadFromState({ heads: [] }, 'deck', {
      id: 'deck', pptxAggregateHead: { generation: 1 }, pptxSemantic: { schemaVersion: 99 },
    })).toThrow('PRESENTATION_PACKAGE_HEAD_MISSING')
  })
})
