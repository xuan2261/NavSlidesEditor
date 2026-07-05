const { readPresentations, readTemplates } = require('./storage')
const { normalizePptxImportedPresentationForRead } = require('./presentation-normalization')
const { normalizeBuiltInTemplates } = require('./template-normalization')
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
  if (found && !found.deletedAt) return normalizePptxImportedPresentationForRead(found)

  // 2. Check custom templates
  const templates = await readTemplates()
  const tmpl = templates.find((t) => t.id === id)
  if (tmpl) return normalizePptxImportedPresentationForRead(tmpl)

  // 3. Check built-in templates
  try {
    const builtIn = await fs.readJson(path.join(__dirname, '..', 'data', 'built-in-templates.json'))
    const bi = normalizeBuiltInTemplates(builtIn).find((t) => t.id === id)
    if (bi) return bi
  } catch {
    // built-in templates file may not exist
  }

  return null
}

/**
 * Serve-guard chokepoint (C2). Returns a user presentation by id ONLY when it
 * exists and is NOT soft-deleted (no `deletedAt`). Returns null otherwise so
 * every serve/fork/export sink can refuse a trashed deck with a single check.
 * Soft-delete does not touch share tokens; restore "just works" because the
 * guard re-admits the deck once `deletedAt` is cleared.
 *
 * Scope is the presentations store only — that is where `deletedAt` lives.
 * Template / built-in fallbacks (which are never trashed) stay in callers.
 *
 * @param {string} id
 * @param {{ normalize?: boolean }} [opts] normalize defaults to true.
 * @returns {Promise<object|null>}
 */
async function findServeablePresentation(id, { normalize = true } = {}) {
  const presentations = await readPresentations()
  const found = presentations.find((p) => p.id === id)
  if (!found || found.deletedAt) return null
  return normalize ? normalizePptxImportedPresentationForRead(found) : found
}

module.exports = { findPresentationById, findServeablePresentation }
