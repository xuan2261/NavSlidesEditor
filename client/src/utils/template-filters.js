import { normalizeTemplateMetadata } from './template-metadata'

export function matchesTemplateCategory(template, category) {
  if (!category) return true
  const normalized = normalizeTemplateMetadata(template)
  return normalized.category === category || normalized.tags.includes(category)
}

export function filterMarketplaceTemplates(templates, category, searchQuery) {
  const query = (searchQuery || '').trim().toLowerCase()
  return templates.map(normalizeTemplateMetadata).filter((template) => {
    if (!matchesTemplateCategory(template, category)) return false
    if (!query) return true
    return (
      template.title.toLowerCase().includes(query) ||
      (template.titleVi || '').toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  })
}
