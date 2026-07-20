import { describe, expect, it } from 'vitest'
import policy from './roundtrip-policy.js'
import payloadModule from './roundtrip-original-parts.js'

const { resolveExportStrategy, shouldPreferOriginalPackage } = policy
const { resolvePptxExportPayload } = payloadModule

describe('roundtrip-policy (Phase 08 scaffold)', () => {
  it('prefers original bytes when unedited and package bound', () => {
    const pres = { pptxOriginal: { id: 'u', sha256: 'a'.repeat(64) } }
    expect(shouldPreferOriginalPackage(pres)).toBe(true)
    expect(resolveExportStrategy(pres).mode).toBe('original-bytes')
  })

  it('uses hybrid when edited or missing original', () => {
    expect(resolveExportStrategy({}).mode).toBe('hybrid-export')
    expect(
      resolveExportStrategy({ pptxOriginal: { id: 'u', sha256: 'a'.repeat(64) }, _pptxEdited: true })
        .mode
    ).toBe('hybrid-export')
  })

  it('prefers authoritative package head over legacy edited flags', () => {
    const pres = {
      pptxOriginal: { id: 'r0', sha256: 'a'.repeat(64) },
      _pptxEdited: true,
      pptxAggregateHead: {
        generation: 2,
        originalRevisionId: 'r0',
        packageRevisionId: 'r1',
        journalRevisionId: 'journal-1',
      },
    }
    expect(resolveExportStrategy(pres)).toEqual({
      mode: 'package-head',
      reason: 'authoritative-journal-head',
      revisionId: 'r1',
    })
  })

  it('uses an authoritative successor head without legacy package metadata', () => {
    expect(resolveExportStrategy({
      pptxAggregateHead: {
        generation: 2,
        originalRevisionId: 'r0',
        packageRevisionId: 'r1',
        journalRevisionId: 'journal-1',
      },
    }).mode).toBe('package-head')
  })

  it('keeps an R0 journal pending until a validated edited export publishes a successor', () => {
    expect(resolveExportStrategy({
      pptxAggregateHead: {
        generation: 2,
        originalRevisionId: 'r0',
        packageRevisionId: 'r0',
        journalRevisionId: 'journal-pending',
      },
    })).toEqual({
      mode: 'pending-edited-export',
      reason: 'validated-edited-export-required',
    })
  })

  it('keeps pending edits pending after a previously validated successor revision', () => {
    expect(resolveExportStrategy({
      pptxAggregateHead: {
        generation: 3,
        originalRevisionId: 'r0',
        packageRevisionId: 'r1',
        journalRevisionId: 'journal-pending',
        pendingJournalHash: 'p'.repeat(64),
      },
    })).toEqual({
      mode: 'pending-edited-export',
      reason: 'validated-edited-export-required',
    })
  })

  it('resolves an unchanged package head through package authority', () => {
    const pres = {
      pptxAggregateHead: {
        generation: 1,
        originalRevisionId: 'r0',
        packageRevisionId: 'r0',
        journalRevisionId: null,
      },
    }
    expect(resolveExportStrategy(pres)).toEqual({
      mode: 'package-head',
      reason: 'authoritative-unchanged-head',
      revisionId: 'r0',
    })
  })

  it('blocks edited unsafe complex objects without blocking exact original recovery', () => {
    const pres = {
      pptxOriginal: { id: 'r0', sha256: 'a'.repeat(64) },
      pptxCapabilitySummary: { editedExport: 'unsupported-blocking' },
    }
    expect(resolveExportStrategy(pres).mode).toBe('original-bytes')
    expect(resolveExportStrategy({ ...pres, _pptxEdited: true })).toEqual({
      mode: 'unsupported-blocking',
      reason: 'unsafe-complex-object-impact',
    })
  })

  it('resolves authoritative package-head bytes and never reconstructs on resolver failure', async () => {
    const presentation = {
      id: 'deck',
      pptxAggregateHead: {
        generation: 2,
        originalRevisionId: 'r0',
        packageRevisionId: 'r1',
        journalRevisionId: 'j1',
      },
    }
    const payload = await resolvePptxExportPayload(presentation, {
      resolvePackageRevision: async (request) => ({
        bytes: Buffer.from('edited'),
        sha256: 'a'.repeat(64),
        revisionId: request.revisionId,
      }),
    })
    expect(payload).toMatchObject({
      mode: 'package-head',
      revisionId: 'r1',
      byteLength: 6,
    })
    await expect(resolvePptxExportPayload(presentation)).rejects.toMatchObject({
      code: 'PACKAGE_RESOLVER_UNAVAILABLE',
    })
    await expect(resolvePptxExportPayload(presentation, {
      resolvePackageRevision: async () => {
        throw Object.assign(new Error('corrupt'), { code: 'PACKAGE_BLOB_CORRUPT' })
      },
    })).rejects.toMatchObject({ code: 'PACKAGE_BLOB_CORRUPT' })
    expect(resolveExportStrategy({})).toMatchObject({ mode: 'hybrid-export' })
  })
})
