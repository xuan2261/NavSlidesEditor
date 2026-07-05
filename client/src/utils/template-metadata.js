export function normalizeTemplateMetadata(template = {}) {
  const tags = Array.isArray(template.tags)
    ? template.tags.map((tag) => String(tag)).filter(Boolean)
    : []
  const slides = Array.isArray(template.slides) ? template.slides : []
  const title = template.title || template.titleVi || template.name || 'Untitled template'

  return {
    ...template,
    id: template.id || title,
    title,
    titleVi: template.titleVi,
    description: template.description || '',
    category: template.category || 'uncategorized',
    tags,
    slides,
    slideCount: typeof template.slideCount === 'number' ? template.slideCount : slides.length,
    difficulty: template.difficulty || '',
  }
}

export function normalizeTemplatePayload(payload = {}) {
  return {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    templates: Array.isArray(payload.templates)
      ? payload.templates.map(normalizeTemplateMetadata)
      : [],
  }
}
