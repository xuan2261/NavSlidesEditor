// Vite pre-bundling-safe inline config: no require() chain, constants inlined directly
// This avoids Vite's esbuild from timing out on large CJS modules in the require tree
const shapeUtils = require('./shapeUtils.js')
const htmlGenerator = require('./htmlGenerator.js')
const slideNotes = require('./slideNotes.js')
const sharedColorUtils = require('./shared-color-utils.js')
const sharedHtmlParser = require('./shared-html-parser.js')
const sharedTextRuns = require('./shared-text-runs.js')
const sharedSlideNotes = require('./shared-slide-notes.js')
const sharedPptxCore = require('./shared-pptx-core.js')
const contentSafety = require('./content-safety.js')

const TEXT_COLORS = [
  '#ffffff', '#e2e8f0', '#94a3b8', '#64748b', '#334155', '#1e293b', '#0f172a', '#000000',
  '#fca5a5', '#f87171', '#ef4444', '#dc2626',
  '#fcd34d', '#fbbf24', '#f59e0b', '#d97706',
  '#86efac', '#4ade80', '#22c55e', '#16a34a',
  '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2',
  '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed',
  '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef',
]

const BG_COLORS = [
  '#1e1e2e', '#0a0a0f', '#1a1a4e', '#0d3349',
  '#1a3a1a', '#3a1a1a', '#2d1b69', '#000000',
  '#ffffff', '#f8f9fa', '#4a4a6a', '#6b3fa0',
]

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #1e1e2e, #4a0e8f)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #360033, #0b8793)',
  'linear-gradient(135deg, #000000, #434343)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #ffecd2, #fcb69f)',
  'linear-gradient(135deg, #a8edea, #fed6e3)',
  'linear-gradient(135deg, #5ee7df, #b490ca)',
  'linear-gradient(135deg, #d9af34, #9d50bb)',
]

function isLightColor(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

module.exports = {
  ...shapeUtils,
  ...htmlGenerator,
  ...slideNotes,
  ...sharedColorUtils,
  ...sharedHtmlParser,
  ...sharedTextRuns,
  ...sharedSlideNotes,
  ...sharedPptxCore,
  ...contentSafety,
  TEXT_COLORS,
  BG_COLORS,
  GRADIENT_PRESETS,
  isLightColor,
}
