import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

afterEach(() => vi.unstubAllGlobals())
describe('scoped picture upload transport', () => {
  it('sends scope and purpose as multipart fields with cancellation outside the body', async () => {
    const receipt = { kind: 'uploaded-picture', presentationId: 'deck' }
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pictureReplacement: receipt }) })
    vi.stubGlobal('fetch', fetch)
    const file = new File(['image'], 'replacement.png', { type: 'image/png' })
    const controller = new AbortController()
    expect(await api.uploadFile(file, { presentationId: 'deck', purpose: 'picture-replacement',
      signal: controller.signal })).toEqual({ pictureReplacement: receipt })
    const [url, request] = fetch.mock.calls[0]
    expect(url).toBe('/api/upload')
    expect(request.method).toBe('POST')
    expect(request.body.get('file')).toBe(file)
    expect(request.body.get('presentationId')).toBe('deck')
    expect(request.body.get('purpose')).toBe('picture-replacement')
    expect(request.body.has('signal')).toBe(false)
    expect(request.signal).toBe(controller.signal)
  })
  it('keeps ordinary uploads unscoped without replacement fields', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: '/uploads/plain.png' }) })
    vi.stubGlobal('fetch', fetch)
    await api.uploadFile(new File(['image'], 'plain.png'))
    const request = fetch.mock.calls[0][1]
    expect(request.body.get('presentationId')).toBeNull()
    expect(request.body.get('purpose')).toBeNull()
    expect(request).not.toHaveProperty('signal')
  })
})
