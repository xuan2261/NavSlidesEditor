import { useEffect, useMemo, useState } from 'react'
import { filterMarketplaceTemplates } from '../../utils/template-filters'
import { normalizeTemplatePayload } from '../../utils/template-metadata'

const FAVORITES_KEY = 'navslides-favorite-templates'
const difficultyScore = { basic: 1, intermediate: 2, advanced: 3 }

function sortTemplates(templates, sortBy) {
  return [...templates].sort((a, b) => {
    if (sortBy === 'difficulty') {
      const diff = (difficultyScore[a.difficulty] || 0) - (difficultyScore[b.difficulty] || 0)
      if (diff !== 0) return diff
    }
    if (sortBy === 'slideCount') {
      const diff = (b.slideCount || 0) - (a.slideCount || 0)
      if (diff !== 0) return diff
    }
    return b.id > a.id ? 1 : -1
  })
}

export function useTemplateGalleryData() {
  const [data, setData] = useState({ categories: [], templates: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/marketplace/templates')
        if (!res.ok) throw new Error('Failed to load templates')
        setData(normalizeTemplatePayload(await res.json()))
      } catch (err) {
        console.error('Failed to load templates:', err)
        setError('Failed to load templates.')
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  return { data, loading, error }
}

export function useTemplateFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return { favorites, toggleFavorite }
}

export function useFilteredTemplates({ templates, activeCategory, searchQuery, favorites, sortBy }) {
  return useMemo(() => {
    let items = activeCategory === 'favorites'
      ? templates.filter((template) => favorites.includes(template.id))
      : templates
    items = filterMarketplaceTemplates(
      items,
      activeCategory === 'favorites' ? '' : activeCategory,
      searchQuery
    )
    return sortTemplates(items, sortBy)
  }, [templates, activeCategory, searchQuery, favorites, sortBy])
}

export function useTemplateCategoryCounts(templates) {
  return useMemo(() => {
    const counts = {}
    templates.forEach((template) => {
      counts[template.category] = (counts[template.category] || 0) + 1
      template.tags.forEach((tag) => {
        if (tag !== template.category) counts[tag] = (counts[tag] || 0) + 1
      })
    })
    return counts
  }, [templates])
}
