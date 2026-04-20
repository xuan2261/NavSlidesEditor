// Minimal Unsplash API integration
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_KEY || '';

export async function searchUnsplash(query) {
  if (!UNSPLASH_ACCESS_KEY) {
    // Return mock data if no key is provided
    console.warn('No Unsplash API key configured. Returning mock data.');
    return [
      {
        id: 'mock-1',
        url: 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=400&auto=format&fit=crop',
        downloadUrl: 'https://images.unsplash.com/photo-1707343843437-caacff5cfa74?q=80&w=1920&auto=format&fit=crop',
        author: 'John Doe',
        authorUrl: 'https://unsplash.com/@johndoe'
      },
      {
        id: 'mock-2',
        url: 'https://images.unsplash.com/photo-1506744626753-eda81829f0ce?q=80&w=400&auto=format&fit=crop',
        downloadUrl: 'https://images.unsplash.com/photo-1506744626753-eda81829f0ce?q=80&w=1920&auto=format&fit=crop',
        author: 'Jane Doe',
        authorUrl: 'https://unsplash.com/@janedoe'
      }
    ];
  }

  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    });
    if (!res.ok) throw new Error('Unsplash fetch failed');
    const data = await res.json();
    return data.results.map(img => ({
      id: img.id,
      url: img.urls.small,
      downloadUrl: img.urls.full,
      author: img.user.name,
      authorUrl: img.user.links.html
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}
