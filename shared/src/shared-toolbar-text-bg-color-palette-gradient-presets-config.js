// Color configuration shared between client and server
// Used by Toolbar.jsx for text/bg color pickers and gradient presets

const TEXT_COLORS = [
  '#ffffff', '#e2e8f0', '#94a3b8', '#64748b', '#334155', '#1e293b', '#0f172a', '#000000',
  '#fca5a5', '#f87171', '#ef4444', '#dc2626',
  '#fcd34d', '#fbbf24', '#f59e0b', '#d97706',
  '#86efac', '#4ade80', '#22c55e', '#16a34a',
  '#6ee7b7', '#34d399', '#10b981', '#059669',
  '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb',
  '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5',
  '#d8b4fe', '#c084fc', '#a855f7', '#7c3aed',
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
  'radial-gradient(ellipse at center, #1e3c72 0%, #2a5298 100%)',
  'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
  'linear-gradient(135deg, #2c3e50, #3498db)',
]

/**
 * Returns true if a hex color is light (luminance > 0.5),
 * so it needs a dark border for visibility.
 * @param {string} hex - hex color string (with or without #)
 */
function isLightColor(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5
}

module.exports = { TEXT_COLORS, BG_COLORS, GRADIENT_PRESETS, isLightColor }
