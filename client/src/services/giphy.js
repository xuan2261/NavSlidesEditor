// Minimal GIPHY API integration
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_KEY || ''

export async function searchGiphy(query) {
  if (!GIPHY_API_KEY) {
    console.warn('No GIPHY API key configured. Returning mock data.')
    return [
      {
        id: 'mock-g1',
        url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
        downloadUrl: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
        author: 'Mock Giphy',
      },
      {
        id: 'mock-g2',
        url: 'https://media.giphy.com/media/13CoXvDkHn1aTe/giphy.gif',
        downloadUrl: 'https://media.giphy.com/media/13CoXvDkHn1aTe/giphy.gif',
        author: 'Mock Giphy 2',
      },
    ]
  }

  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20`
    )
    if (!res.ok) throw new Error('GIPHY fetch failed')
    const data = await res.json()
    const results = Array.isArray(data.data) ? data.data : []
    return results
      .map((gif) => {
        const url = gif.images?.fixed_width?.url || gif.images?.original?.url
        const downloadUrl = gif.images?.original?.url || gif.images?.fixed_width?.url
        if (!url || !downloadUrl) return null
        return {
          id: gif.id,
          url,
          downloadUrl,
          author: gif.username || 'Giphy',
        }
      })
      .filter(Boolean)
  } catch {
    throw new Error('Failed to load media')
  }
}
