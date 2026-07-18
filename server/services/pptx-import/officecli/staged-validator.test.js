import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import validatorModule from './staged-validator.js'

const { createStagedOfficeCliValidator } = validatorModule

describe('staged OfficeCLI validator', () => {
  it('binds only security-approved staged bytes to a guarded revision', async () => {
    const bytes = Buffer.from('staged-package')
    const validatePackage = vi.fn(async (revision) => ({ ok: true, data: { ok: true }, revision }))
    const validator = createStagedOfficeCliValidator({
      securityPreflight: async () => ({ ok: true }),
      createGateway: ({ readRevision }) => ({ validatePackage: async (revision) => {
        expect(await readRevision(revision)).toBe(bytes)
        return validatePackage(revision)
      } }),
    })
    await expect(validator({ afterBytes: bytes })).resolves.toBe(true)
    expect(validatePackage).toHaveBeenCalledWith(expect.objectContaining({
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      byteLength: bytes.length,
      safetyVerdict: expect.objectContaining({ rawZipSafe: true, xmlSafe: true }),
    }))
  })

  it('fails closed without creating a gateway for unsafe or failed validation', async () => {
    const createGateway = vi.fn()
    const unsafe = createStagedOfficeCliValidator({ securityPreflight: async () => ({ ok: false }), createGateway })
    await expect(unsafe({ afterBytes: Buffer.from('bad') })).resolves.toBe(false)
    expect(createGateway).not.toHaveBeenCalled()

    const failed = createStagedOfficeCliValidator({
      securityPreflight: async () => ({ ok: true }),
      createGateway: () => ({ validatePackage: async () => ({ ok: false }) }),
    })
    await expect(failed({ afterBytes: Buffer.from('valid') })).resolves.toBe(false)
  })
})
