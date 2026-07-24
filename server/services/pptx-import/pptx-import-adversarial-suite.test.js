import { describe, expect, it } from 'vitest'
import suite from './pptx-import-adversarial-suite.js'
import fixtures from './pptx-import-adversarial-fixtures.js'
import guards from './pptx-guards.js'

const { ADVERSARIAL_CASES, runAdversarialSuite } = suite
const { buildBadCrcPackage, buildExternalRelPackage, buildNestedPackage } = fixtures
const { IMPORT_CRC_POLICY, validatePptxPackage } = guards

describe('pptx adversarial corpus lane', () => {
  it('declares expected reject/map table isolated from metrics averages', () => {
    expect(ADVERSARIAL_CASES.some((row) => row.id === 'C1' && row.code === IMPORT_CRC_POLICY.errorCode)).toBe(true)
    expect(ADVERSARIAL_CASES.some((row) => row.id === 'C3' && row.expect === 'reject')).toBe(true)
    expect(ADVERSARIAL_CASES.some((row) => row.id === 'C5' && row.assertNoNetwork)).toBe(true)
    expect(ADVERSARIAL_CASES.every((row) => row.fixture.endsWith('.pptx'))).toBe(true)
  })

  it('runs full adversarial suite with expected outcomes (C1–C6)', async () => {
    const summary = await runAdversarialSuite()
    expect(summary.lane).toBe('adversarial')
    expect(summary.ok).toBe(true)
    expect(summary.failed).toBe(0)
    expect(summary.results.find((row) => row.id === 'C1')).toMatchObject({
      ok: true, actual: 'reject', code: 'zip-crc-mismatch',
    })
    expect(summary.results.find((row) => row.id === 'C5')).toMatchObject({
      ok: true, actual: 'map', networkHits: 0,
    })
  })

  it('nested package exceeds depth via inventory gate (C3)', async () => {
    const bytes = await buildNestedPackage(4)
    await expect(
      import('./package-store/opc-inventory.js').then((m) => m.default.buildOpcInventory(bytes, { maxNestedDepth: 2 }))
    ).rejects.toMatchObject({ code: 'zip-recursion-depth-exceeded' })
  })

  it('external relationship package does not trigger network (C5)', async () => {
    const bytes = await buildExternalRelPackage()
    const summary = await runAdversarialSuite()
    const c5 = summary.results.find((row) => row.id === 'C5')
    expect(c5).toMatchObject({ ok: true, networkHits: 0 })
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('bad CRC fixture is rejected by package gate alone', async () => {
    const fs = await import('node:fs/promises')
    const os = await import('node:os')
    const path = await import('node:path')
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-adv-crc-'))
    const file = path.join(dir, 'bad-crc.pptx')
    try {
      await fs.writeFile(file, await buildBadCrcPackage())
      await expect(validatePptxPackage(file, 'bad-crc.pptx')).rejects.toMatchObject({
        code: 'zip-crc-mismatch',
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
