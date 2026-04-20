// Minimal GIPHY API integration
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_KEY || '';

export async function searchGiphy(query) {
  if (!GIPHY_API_KEY) {
    console.warn('No GIPHY API key configured. Returning mock data.');
    return [
      {
        id: 'mock-g1',
        url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
        downloadUrl: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
        author: 'Mock Giphy'
      },
      {
        id: 'mock-g2',
        url: 'https://media.giphy.com/media/13CoXvDkHn1aTe/giphy.gif',
        downloadUrl: 'https://media.giphy.com/media/13CoXvDkHn1aTe/giphy.gif',
        author: 'Mock Giphy 2'
      }
    ];
  }

  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20`);
    if (!res.ok) throw new Error('GIPHY fetch failed');
    const data = await res.json();
    return data.data.map(gif => ({
      id: gif.id,
      url: gif.images.fixed_width.url,
      downloadUrl: gif.images.original.url,
      author: gif.username || 'Giphy'
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}
