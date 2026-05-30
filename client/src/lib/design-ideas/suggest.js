/**
 * Design Ideas suggestion engine (heuristic, no AI).
 *
 * `suggestDesigns(slide, opts)` turns a slide + the analysis of its content
 * into 3-5 ranked, deterministic suggestions of two kinds:
 *   - layout: re-fit the current content into a built-in Phase-3 template.
 *   - theme:  pair the deck with a Phase-2 token preset.
 *
 * Pure, side-effect free, fast (rule table, not ML). Never throws and never
 * returns a negative score. Ordering is stable: score desc, then id asc.
 */
import { THEME_PRESETS } from 'revealjs-shared'
import { SLIDE_TEMPLATES } from '../../data/slide-templates'
import { analyzeSlide } from './analyze-slide'

const MAX_RESULTS = 5
const MAX_LAYOUTS = 2

// Curated intent table (rule table, not ML). Each list is ordered by general
// usefulness; entries are matched against whatever templates the caller passes,
// so a missing/renamed template id is simply skipped (never throws).
const LAYOUT_INTENT = {
  // Concise, centered slides — good for a title / subtitle / single statement.
  title: [
    'title', 'section-header', 'cover-hero', 'big-number', 'stat-callout',
    'quote', 'big-quote', 'quote-with-author', 'definition', 'thank-you',
  ],
  // Multi-region slides — good for spreading dense or comparative content.
  wide: [
    'agenda', 'two-column', 'three-column', 'four-grid', 'comparison', 'pro-con',
  ],
}

const LAYOUT_BASE_SCORE = 80
const EXACT_SLOT_BONUS = 5
const THEME_TOP_SCORE = 60

function countTextSlots(template) {
  const els = Array.isArray(template?.elements) ? template.elements : []
  return els.filter((el) => el && el.type === 'text').length
}

// A layout is offered only when the current content maps cleanly: the slide is
// non-empty and entirely text (built-in templates expose only text/shape slots,
// so any image/chart/table/etc. makes the mapping ambiguous -> theme-only).
function layoutsAllowed(analysis) {
  return (
    analysis.elementCount > 0 &&
    analysis.types.length === 1 &&
    analysis.types[0] === 'text'
  )
}

function chooseIntent(analysis) {
  if (analysis.titleOnly || analysis.density === 'sparse') return 'title'
  return 'wide'
}

function buildLayoutSuggestions(analysis, templates) {
  if (!layoutsAllowed(analysis)) return []
  const intent = chooseIntent(analysis)
  const contentText = analysis.elementCount // text-only slide => all are text
  const out = []

  for (const id of LAYOUT_INTENT[intent]) {
    const template = templates[id]
    if (!template) continue
    const slots = countTextSlots(template)
    // Content must fit into the template's text slots.
    if (slots < contentText) continue
    const exact = slots === contentText ? EXACT_SLOT_BONUS : 0
    out.push({
      kind: 'layout',
      templateId: id,
      label: template.label || id,
      score: LAYOUT_BASE_SCORE + exact,
      preview: {
        icon: template.icon || '▦',
        category: template.category || 'layout',
        slots,
      },
    })
  }

  return sortSuggestions(out).slice(0, MAX_LAYOUTS)
}

function buildThemeSuggestions(presets, currentTokens, count) {
  if (count <= 0) return []
  const currentAccent = currentTokens?.colors?.accent
  const pool = presets.filter((p) => p?.tokens?.colors?.accent !== currentAccent)

  // Greedy two-pass selection for category variety + determinism: first take one
  // preset per unseen category in input order, then fill from the remainder.
  const seenCats = new Set()
  const picked = []
  for (const p of pool) {
    if (picked.length >= count) break
    if (seenCats.has(p.category)) continue
    seenCats.add(p.category)
    picked.push(p)
  }
  for (const p of pool) {
    if (picked.length >= count) break
    if (!picked.includes(p)) picked.push(p)
  }

  // Strictly descending scores by pick order so themes rank below layouts and
  // never tie with each other (keeps ordering fully determinate).
  return picked.map((p, i) => ({
    kind: 'theme',
    presetId: p.id,
    label: p.label || p.id,
    score: Math.max(0, THEME_TOP_SCORE - i),
    preview: {
      category: p.category,
      colors: { ...p.tokens.colors },
    },
  }))
}

// Stable order: score desc, then id (templateId|presetId) asc.
function sortSuggestions(list) {
  const keyOf = (s) => s.templateId || s.presetId || ''
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0
  })
}

/**
 * @param {object|null} slide
 * @param {object} [opts]
 * @param {object} [opts.templates] - id -> template (defaults to SLIDE_TEMPLATES).
 * @param {Array}  [opts.presets]   - theme presets (defaults to THEME_PRESETS).
 * @param {object} [opts.currentTokens] - deck's active token set; its accent is
 *                                         excluded from theme suggestions.
 * @returns {Array} 3-5 Suggestion objects.
 */
export function suggestDesigns(slide, opts = {}) {
  const templates = opts.templates || SLIDE_TEMPLATES
  const presets = Array.isArray(opts.presets) ? opts.presets : THEME_PRESETS
  const currentTokens = opts.currentTokens

  const analysis = analyzeSlide(slide)
  const layouts = buildLayoutSuggestions(analysis, templates)

  // Fill the remaining slots with themes. With 35+ presets this always clears
  // MIN_RESULTS even when no layout fits (empty/non-text slide -> theme-only).
  const themeCount = MAX_RESULTS - layouts.length
  const themes = buildThemeSuggestions(presets, currentTokens, themeCount)

  return sortSuggestions([...layouts, ...themes]).slice(0, MAX_RESULTS)
}
