import { SLIDE_TEMPLATES } from './slide-templates'

function placeholderRole(element, index) {
  if (element.type === 'image') return 'image'
  if (element.type === 'video' || element.type === 'audio') return 'media'
  if (element.type === 'chart') return 'chart'
  if (element.type !== 'text') return 'custom'
  const content = String(element.content || '').toLowerCase()
  if (/<h1\b/.test(content)) return 'title'
  if (/<h2\b/.test(content) || /subtitle|author name/.test(content)) return 'subtitle'
  if (/footer|copyright/.test(content)) return 'footer'
  return index === 0 ? 'title' : 'body'
}

function layoutElementDefaults(element) {
  const defaults = { ...element }
  for (const key of ['id', 'x', 'y', 'width', 'height', 'zIndex', 'locked']) delete defaults[key]
  return defaults
}

function toSystemLayout(id, template) {
  const elements = Array.isArray(template.elements) ? template.elements : []
  return {
    id,
    name: template.label,
    system: true,
    fixedElements: elements
      .filter((element) => element.type !== 'text')
      .map((element, index) => ({ ...element, id: `${id}:fixed:${index}`, locked: true })),
    placeholders: elements
      .filter((element) => element.type === 'text')
      .map((element, index) => ({
        id: `${id}:placeholder:${index}`,
        type: element.type,
        role: placeholderRole(element, index),
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        ...(element.zIndex != null ? { zIndex: element.zIndex } : {}),
        ...(element.locked != null ? { locked: element.locked } : {}),
        contentPolicy: { elementDefaults: layoutElementDefaults(element) },
      })),
  }
}

/** Derives system masters from the stable template registry; never mutates it. */
export function getSystemLayoutMasters() {
  return Object.entries(SLIDE_TEMPLATES).map(([id, template]) => toSystemLayout(id, template))
}

export function getSystemLayoutMaster(templateId) {
  const template = SLIDE_TEMPLATES[templateId]
  return template ? toSystemLayout(templateId, template) : null
}
