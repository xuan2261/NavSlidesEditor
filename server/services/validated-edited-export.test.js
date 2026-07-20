import { describe, expect, it, vi } from 'vitest'
import exportModule from './validated-edited-export.js'

const { configuredLauncherClient, createQualifiedValidators } = exportModule

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
})
