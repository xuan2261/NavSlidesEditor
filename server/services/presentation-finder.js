const { readPresentations, readTemplates } = require('./storage')
const path = require('path')
const fs = require('fs-extra')

/**
 * Find a presentation by ID — checks presentations, custom templates,
 * and built-in templates in order. Eliminates 3x duplicated lookup logic.
 */
async function findPresentationById(id) {
  // 1. Check user presentations
  const presentations = await readPresentations()
  const found = presentations.find((p) => p.id === id)
  if (found) return found

  // 2. Check custom templates
  const templates = await readTemplates()
  const tmpl = templates.find((t) => t.id === id)
  if (tmpl) return tmpl

  // 3. Check built-in templates
  try {
    const builtIn = await fs.readJson(path.join(__dirname, '..', 'data', 'built-in-templates.json'))
    const bi = builtIn.find((t) => t.id === id)
    if (bi) return bi
  } catch {
    // built-in templates file may not exist
  }

  return null
}

module.exports = { findPresentationById }
