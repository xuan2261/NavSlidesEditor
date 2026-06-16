import { afterEach, describe, expect, it, vi } from 'vitest'

async function importProviderWithEnv(envName, key) {
  vi.resetModules()
  vi.stubEnv(envName, key)
  return envName === 'VITE_UNSPLASH_KEY'
    ? import('./unsplash.js')
    : import('./giphy.js')
}

describe('media provider contracts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('normalizes Unsplash provider failures without exposing provider details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    )
    const { searchUnsplash } = await importProviderWithEnv('VITE_UNSPLASH_KEY', 'unsplash-secret')

    await expect(searchUnsplash('nature')).rejects.toThrow('Failed to load media')
  })

  it('filters malformed Unsplash rows instead of returning unusable media items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { id: 'broken', urls: {}, user: {} },
            {
              id: 'valid',
              urls: { regular: 'https://images.example/valid.jpg' },
              user: { name: 'Valid Author' },
            },
          ],
        }),
      })
    )
    const { searchUnsplash } = await importProviderWithEnv('VITE_UNSPLASH_KEY', 'unsplash-secret')

    await expect(searchUnsplash('nature')).resolves.toEqual([
      {
        id: 'valid',
        url: 'https://images.example/valid.jpg',
        downloadUrl: 'https://images.example/valid.jpg',
        author: 'Valid Author',
        authorUrl: '',
      },
    ])
  })

  it('normalizes GIPHY provider failures without exposing provider details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 })
    )
    const { searchGiphy } = await importProviderWithEnv('VITE_GIPHY_KEY', 'giphy-secret')

    await expect(searchGiphy('demo')).rejects.toThrow('Failed to load media')
  })

  it('filters malformed GIPHY rows instead of returning unusable media items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'broken', images: {} },
            {
              id: 'valid',
              images: {
                fixed_width: { url: 'https://media.example/preview.gif' },
                original: { url: 'https://media.example/original.gif' },
              },
              username: 'Gif Author',
            },
          ],
        }),
      })
    )
    const { searchGiphy } = await importProviderWithEnv('VITE_GIPHY_KEY', 'giphy-secret')

    await expect(searchGiphy('demo')).resolves.toEqual([
      {
        id: 'valid',
        url: 'https://media.example/preview.gif',
        downloadUrl: 'https://media.example/original.gif',
        author: 'Gif Author',
      },
    ])
  })
})
