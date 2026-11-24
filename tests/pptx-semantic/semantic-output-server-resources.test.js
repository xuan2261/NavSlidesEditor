import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
const servicePath = '../../server/services/pptx-import/semantic-output-resources'
const { model } = require('./semantic-output-server-fixture')
const load = () => require(servicePath).prepareSemanticOutputResources
afterEach(() => vi.unstubAllEnvs())

describe('authoritative server output font resources', () => {
  it('keeps legacy resource-free and allows zero-face output without roots', async () => {
    vi.stubEnv('NAVSLIDES_PPTX_FONT_ROOTS', '')
    expect(await load()({ slides: [] })).toBeNull()
    const semantic = { schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {} }
    expect(await load()({ pptxSemantic: semantic })).toEqual({
      schemaVersion: 1,
      sourceIdentity: require('../../server/services/pptx-import/semantic-font-request')
        .semanticFontSourceIdentity(semantic),
      fontProfile: { schemaVersion: 1, faces: [] }, assets: [],
    })
  })
  it('transports real face bytes with exact SHA-256 and no private bindings', async () => {
    const root = path.resolve('server/vendor/katex/dist/fonts')
    vi.stubEnv('NAVSLIDES_PPTX_FONT_ROOTS', JSON.stringify([root]))
    const resources = await load()({ pptxSemantic: model(), privateToken: 'secret' })
    const bytes = await readFile(path.join(root, 'KaTeX_Main-Regular.ttf'))
    expect(resources.assets).toHaveLength(1)
    expect(Buffer.from(resources.assets[0].bytesBase64, 'base64').equals(bytes)).toBe(true)
    expect(resources.fontProfile.faces[0]).toEqual({
      id: 'source-0', typeface: 'KaTeX_Main', bold: false, italic: false,
      assetHash: createHash('sha256').update(bytes).digest('hex'),
    })
    expect(Object.keys(resources).sort()).toEqual(['assets', 'fontProfile', 'schemaVersion', 'sourceIdentity'])
    expect(JSON.stringify(resources)).not.toMatch(/secret|bindings|rendererProfile|runtimeAlias/)
    expect(JSON.stringify(resources)).not.toContain(root)
  })
  it('rejects missing configuration with located required-face issues', async () => {
    vi.stubEnv('NAVSLIDES_PPTX_FONT_ROOTS', '')
    await expect(load()({ pptxSemantic: model() })).rejects.toMatchObject({
      code: 'semantic-output-font-unavailable', status: 422,
      issues: expect.arrayContaining([expect.objectContaining({ instanceId: 'i', componentId: 'run' })]),
    })
  })
  it('honors cancellation before delivery', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(load()({ pptxSemantic: model() }, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })
  })
  it.each(['hash', 'duplicate', 'missing', 'stale', 'size'])('rejects %s delivery', async (kind) => {
    const delivery = require('../../server/services/pptx-import/semantic-font-delivery')
    const original = delivery.resolveSemanticFontDelivery
    const bytes = new Uint8Array(kind === 'size' ? 25 * 1024 * 1024 : 4).buffer
    delivery.resolveSemanticFontDelivery = async (_presentation, sourceIdentity) => ({
      sourceIdentity: kind === 'stale' ? '0'.repeat(64) : sourceIdentity, status: 'ready', issues: [],
      fontProfile: { schemaVersion: 1, faces: [{
        id: 'source-0', typeface: 'KaTeX_Main', bold: false, italic: false,
        assetHash: kind === 'hash' ? '0'.repeat(64) : createHash('sha256').update(Buffer.from(bytes)).digest('hex'),
      }] },
      assets: kind === 'duplicate' ? [{ faceId: 'source-0', bytes }, { faceId: 'source-0', bytes }]
        : kind === 'missing' ? [] : [{ faceId: 'source-0', bytes }],
    })
    delete require.cache[require.resolve(servicePath)]
    try {
      await expect(load()({ pptxSemantic: model() })).rejects.toMatchObject({
        code: { hash: 'source-font-delivery-hash-mismatch', duplicate: 'source-font-profile-invalid',
          missing: 'source-font-profile-invalid', stale: 'source-font-source-stale',
          size: 'source-font-asset-budget' }[kind],
      })
    } finally {
      delivery.resolveSemanticFontDelivery = original
      delete require.cache[require.resolve(servicePath)]
    }
  })
})
