// @vitest-environment node
import { describe, expect, it } from 'vitest'
import mediaModule from './project-import-archive-media'
import validationModule from './project-import-archive-validation'

const { localMediaFilename, validateMediaPayload, validateV2MediaInventory } = mediaModule

describe('portable owned local media boundary', () => {
  it('classifies exact local origin without converting external upload-lookalike URLs into files', () => {
    expect(localMediaFilename('/uploads/photo.png?x=1#preview')).toBe('photo.png')
    expect(localMediaFilename('http://localhost/uploads/photo.png', 'http://localhost')).toBe('photo.png')
    expect(localMediaFilename('https://attacker.test/uploads/photo.png', 'http://localhost')).toBeNull()
    expect(localMediaFilename('//attacker.test/uploads/photo.png', 'http://localhost')).toBeNull()
  })

  it.each(['/uploads/%2e%2e%2fsecret.png', '/uploads/a%5cb.png', '/uploads/a.png:stream', '/uploads/a.png%00']) (
    'rejects unsafe local URL %s', (url) => {
      expect(() => localMediaFilename(url)).toThrow(expect.objectContaining({ code: 'PROJECT_MEDIA_URL_INVALID' }))
    },
  )

  it.each(['emf', 'wmf'])('requires exact %s MIME, signature and explicit limited browser support', async (ext) => {
    const bytes = ext === 'emf' ? Buffer.from([1, 0, 0, 0]) : Buffer.from([215, 205, 198, 154])
    const item = { archivePath: `media/image.${ext}`, mimeType: `image/x-${ext}`, browserSupport: 'limited' }
    await expect(validateMediaPayload(item, bytes, { packageBacked: true })).resolves.toMatch(/^[a-f0-9]{64}$/u)
    for (const invalid of [{ ...item, mimeType: 'image/png' }, { ...item, browserSupport: undefined }]) {
      await expect(validateMediaPayload(invalid, bytes, { packageBacked: true })).rejects.toMatchObject({ code: 'PROJECT_MEDIA_TYPE_REJECTED' })
    }
    await expect(validateMediaPayload(item, Buffer.from('wrong-signature'), { packageBacked: true }))
      .rejects.toMatchObject({ code: 'PROJECT_MEDIA_TYPE_REJECTED' })
    await expect(validateMediaPayload(item, bytes)).rejects.toMatchObject({ code: 'PROJECT_MEDIA_TYPE_REJECTED' })
  })

  it.each(['MZxx', 'PK\u0003\u0004', 'PK\u0005\u0006', 'PK\u0007\u0008'])('rejects executable/ZIP media payload %s', async (signature) => {
    await expect(validateMediaPayload({ archivePath: 'media/photo.png' }, Buffer.from(signature, 'binary'), { packageBacked: true }))
      .rejects.toMatchObject({ code: 'PROJECT_MEDIA_TYPE_REJECTED' })
  })

  it('requires an exact external media inventory, not an external URL marked local', () => {
    const projections = [{ slides: [{ elements: [{ src: 'https://external.test/video.mp4' }] }] }]
    const limits = { maxMedia: 1000, maxEntryBytes: 1024, maxNesting: 3, maxPathLength: 240 }
    expect(() => validateV2MediaInventory({ media: [], externalLinks: [] }, [], limits, projections))
      .toThrow(expect.objectContaining({ code: 'PROJECT_EXTERNAL_LINKS_MISMATCH' }))
    expect(validateV2MediaInventory({ media: [], externalLinks: [{ url: 'https://external.test/video.mp4', type: 'external-media' }] }, [], limits, projections)).toEqual([])
  })

  it('requires active-content acknowledgement for approved root fixed-element snapshots', () => {
    expect(validationModule.activeContentInventory({ slides: [], fixedElements: [
      { type: 'html', content: '<section>Retained root HTML</section>' },
    ] })).toEqual(['html-element'])
    expect(validationModule.activeContentInventory()).toEqual([])
  })
})
