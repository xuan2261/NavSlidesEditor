import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import inventoryModule from './inventory.js'
import officeAdapterModule from './officecli-adapter.js'
import orchestratorModule from './orchestrator.js'
import promotionModule from './promotion.js'

const { createInventory } = inventoryModule
const { readOfficeCliInventory } = officeAdapterModule
const { runShadowReconciliation } = orchestratorModule
const { resolvePromotionPolicy } = promotionModule

function revisionFor(bytes) {
  return {
    id: 'r1',
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.length,
  }
}

describe('promotion and shadow orchestration', () => {
  it('defaults every feature to native and requires complete evidence to promote', () => {
    expect(resolvePromotionPolicy({ geometry: { requestedSource: 'officecli' } }).geometry.source)
      .toBe('native')
    expect(resolvePromotionPolicy({
      geometry: {
        requestedSource: 'officecli',
        evidence: { corpus: true, semantic: true, roundtrip: true, drift: true },
      },
    }).geometry.source).toBe('officecli')
  })

  it('uses only the typed read gateway and rejects source drift', async () => {
    const before = Buffer.from('package')
    const after = Buffer.from('changed')
    const gateway = { inventoryObjects: vi.fn().mockResolvedValue({ data: { objects: [] } }) }
    await expect(readOfficeCliInventory({
      gateway,
      revision: revisionFor(before),
      slides: [{ index: 0, part: 'ppt/slides/slide1.xml' }],
      readRevision: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after),
    })).rejects.toMatchObject({ code: 'SHADOW_READ_DRIFT' })
    expect(gateway.inventoryObjects).toHaveBeenCalledTimes(1)
  })

  it('preserves native projection when shadow is disabled or unavailable', async () => {
    const nativeProjection = { slides: [{ elements: [{ id: 'a' }] }] }
    const disabled = await runShadowReconciliation({ nativeProjection, enabled: false })
    expect(disabled.projection).toBe(nativeProjection)
    const unavailable = await runShadowReconciliation({
      nativeProjection,
      enabled: true,
      nativeInventory: createInventory({ source: 'native', slides: [] }),
      gateway: { probeCapability: vi.fn().mockResolvedValue({ inspection: false }) },
    })
    expect(unavailable.projection).toBe(nativeProjection)
    expect(unavailable.shadow.status).toBe('unavailable')
  })

  it('propagates cancellation before shadow admission', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(runShadowReconciliation({
      nativeProjection: {},
      enabled: true,
      signal: controller.signal,
    })).rejects.toMatchObject({ code: 'CANCELLED' })
  })

  it('reserves and releases admission without changing projection', async () => {
    const bytes = Buffer.from('package')
    const release = vi.fn()
    const admission = { reserve: vi.fn().mockResolvedValue(release) }
    const nativeProjection = { slides: [] }
    const result = await runShadowReconciliation({
      nativeProjection,
      nativeInventory: createInventory({
        source: 'native',
        revisionId: 'r1',
        slides: [{ part: 'ppt/slides/slide1.xml', index: 0, objects: [] }],
      }),
      enabled: true,
      revision: revisionFor(bytes),
      readRevision: vi.fn().mockResolvedValue(bytes),
      admission,
      gateway: {
        probeCapability: vi.fn().mockResolvedValue({ inspection: true }),
        inventoryObjects: vi.fn().mockResolvedValue({ data: { objects: [] } }),
      },
    })
    expect(result.projection).toBe(nativeProjection)
    expect(result.shadow.status).toBe('complete')
    expect(result.shadow.report.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(admission.reserve).toHaveBeenCalledWith({ weight: 1, signal: undefined })
    expect(release).toHaveBeenCalledOnce()
  })
})
