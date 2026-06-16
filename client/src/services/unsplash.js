// Minimal Unsplash API integration
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_KEY || ''

export async function searchUnsplash(query) {
  if (!UNSPLASH_ACCESS_KEY) {
    // Return mock data if no key is provided
    console.warn('No Unsplash API key configured. Returning mock data.')
    return [
      {
        id: 'mock-1',
        url: 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=400&auto=format&fit=crop',
        downloadUrl:
          'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=1920&auto=format&fit=crop',
        author: 'John Doe',
        authorUrl: 'https://unsplash.com/@johndoe',
      },
      {
        id: 'mock-2',
        url: 'https://images.unsplash.com/photo-1506744626753-eda81829f0ce?q=80&w=400&auto=format&fit=crop',
        downloadUrl:
          'https://images.unsplash.com/photo-1506744626753-eda81829f0ce?q=80&w=1920&auto=format&fit=crop',
        author: 'Jane Doe',
        authorUrl: 'https://unsplash.com/@janedoe',
      },
    ]
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20`,
      {
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      }
    )
    if (!res.ok) throw new Error('Unsplash fetch failed')
    const data = await res.json()
    const results = Array.isArray(data.results) ? data.results : []
    return results
      .map((img) => {
        const url = img.urls?.small || img.urls?.regular || img.urls?.full
        const downloadUrl = img.urls?.full || img.urls?.regular || img.urls?.small
        if (!url || !downloadUrl) return null
        return {
          id: img.id,
          url,
          downloadUrl,
          author: img.user?.name || 'Unsplash',
          authorUrl: img.user?.links?.html || '',
        }
      })
      .filter(Boolean)
  } catch {
    throw new Error('Failed to load media')
  }
}
