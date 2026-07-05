function normalizeSlideBackground(background) {
  if (typeof background === 'string') return { type: 'color', color: background }
  return background
}

function normalizeBuiltInTemplate(template) {
  return {
    ...template,
    slides: (template.slides || []).map((slide, slideIndex) => ({
      ...slide,
      id: slide.id || `slide-${slideIndex + 1}`,
      background: normalizeSlideBackground(slide.background),
      elements: (slide.elements || []).map((element, elementIndex) => ({
        ...element,
        id: element.id || `el-${slideIndex + 1}-${elementIndex + 1}`,
        zIndex: typeof element.zIndex === 'number' ? element.zIndex : elementIndex + 1,
      })),
    })),
  }
}

function normalizeBuiltInTemplates(templates) {
  return (templates || []).map(normalizeBuiltInTemplate)
}

module.exports = {
  normalizeBuiltInTemplate,
  normalizeBuiltInTemplates,
  normalizeSlideBackground,
}
