/**
 * Theme presets: design-token sets that drive theme-aware recoloring.
 *
 * Palette + typography VALUES are adapted from lewislulu/html-ppt-skill (MIT) and
 * other common editorial palettes, re-expressed in NavSlides' own token shape
 * (see shared/src/design-tokens.js). No upstream CSS is copied — only the data.
 * Attribution: see the repo-root NOTICE file.
 *
 * Each preset: { id, label, category, tokens: {colors, fonts, radius, spacingScale}, revealTheme }.
 * `revealTheme` is the closest existing reveal.js theme for non-tokenized chrome.
 */

// Reusable font stacks (kept DRY; referenced by presets below).
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const SERIF = 'Georgia, "Times New Roman", Times, serif'
const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace'
const GEOMETRIC = '"Inter", "Helvetica Neue", Arial, sans-serif'
const HUMANIST = '"Segoe UI", "Open Sans", system-ui, sans-serif'

// Helper to keep each preset terse while filling the full token contract.
function preset(id, label, category, revealTheme, colors, fonts, radius = 8, spacingScale = 1) {
  return {
    id,
    label,
    category,
    revealTheme,
    tokens: {
      colors,
      fonts: { heading: fonts[0], body: fonts[1] },
      radius,
      spacingScale,
    },
  }
}

const THEME_PRESETS = [
  // ── Minimal / clean ──────────────────────────────────────────────────────
  preset('minimal-white', 'Minimal White', 'minimal', 'white',
    { bg: '#ffffff', surface: '#f5f5f7', accent: '#0066cc', accent2: '#5599dd', text: '#1d1d1f', muted: '#6e6e73' },
    [GEOMETRIC, GEOMETRIC], 6),
  preset('minimal-dark', 'Minimal Dark', 'minimal', 'black',
    { bg: '#0a0a0f', surface: '#1a1a22', accent: '#6366f1', accent2: '#8b5cf6', text: '#ffffff', muted: 'rgba(255,255,255,0.6)' },
    [GEOMETRIC, GEOMETRIC], 8),
  preset('swiss-grid', 'Swiss Grid', 'minimal', 'white',
    { bg: '#ffffff', surface: '#eeeeee', accent: '#e30613', accent2: '#111111', text: '#111111', muted: '#666666' },
    [HUMANIST, HUMANIST], 0),
  preset('mono-paper', 'Mono Paper', 'minimal', 'simple',
    { bg: '#fafafa', surface: '#f0f0f0', accent: '#222222', accent2: '#555555', text: '#1a1a1a', muted: '#888888' },
    [MONO, MONO], 2),
  preset('soft-gray', 'Soft Gray', 'minimal', 'simple',
    { bg: '#f8f9fa', surface: '#e9ecef', accent: '#495057', accent2: '#adb5bd', text: '#212529', muted: '#868e96' },
    [SANS, SANS], 6),

  // ── Editorial / academic ─────────────────────────────────────────────────
  preset('editorial-serif', 'Editorial Serif', 'editorial', 'serif',
    { bg: '#fcfcf9', surface: '#f0ede4', accent: '#8b2e2e', accent2: '#c4915c', text: '#1a1a1a', muted: '#6b6b6b' },
    [SERIF, SERIF], 4),
  preset('academic-paper', 'Academic Paper', 'editorial', 'serif',
    { bg: '#ffffff', surface: '#f7f7f5', accent: '#003366', accent2: '#6688aa', text: '#222222', muted: '#777777' },
    [SERIF, SERIF], 2),
  preset('magazine-bold', 'Magazine Bold', 'editorial', 'white',
    { bg: '#ffffff', surface: '#1a1a1a', accent: '#ff2d55', accent2: '#ffcc00', text: '#111111', muted: '#888888' },
    [GEOMETRIC, SERIF], 0),
  preset('manuscript', 'Manuscript', 'editorial', 'beige',
    { bg: '#f4ecd8', surface: '#e8dcc0', accent: '#7b3f00', accent2: '#a0522d', text: '#3a2e1f', muted: '#8a7a5c' },
    [SERIF, SERIF], 4),
  preset('newsprint', 'Newsprint', 'editorial', 'simple',
    { bg: '#f5f5f0', surface: '#e0e0d8', accent: '#1a1a1a', accent2: '#8b0000', text: '#1a1a1a', muted: '#666660' },
    [SERIF, SANS], 0),

  // ── Developer / dark code ──────────────────────────────────────────────────
  preset('dracula', 'Dracula', 'developer', 'dracula',
    { bg: '#282a36', surface: '#44475a', accent: '#bd93f9', accent2: '#ff79c6', text: '#f8f8f2', muted: '#6272a4' },
    [MONO, SANS], 8),
  preset('tokyo-night', 'Tokyo Night', 'developer', 'night',
    { bg: '#1a1b26', surface: '#24283b', accent: '#7aa2f7', accent2: '#bb9af7', text: '#c0caf5', muted: '#565f89' },
    [MONO, SANS], 8),
  preset('nord', 'Nord', 'developer', 'night',
    { bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0', accent2: '#81a1c1', text: '#eceff4', muted: '#8a93a5' },
    [SANS, SANS], 6),
  preset('monokai', 'Monokai', 'developer', 'black',
    { bg: '#272822', surface: '#3e3d32', accent: '#a6e22e', accent2: '#f92672', text: '#f8f8f2', muted: '#75715e' },
    [MONO, MONO], 6),
  preset('one-dark', 'One Dark', 'developer', 'black',
    { bg: '#282c34', surface: '#3a3f4b', accent: '#61afef', accent2: '#c678dd', text: '#abb2bf', muted: '#5c6370' },
    [MONO, SANS], 8),
  preset('github-dark', 'GitHub Dark', 'developer', 'black',
    { bg: '#0d1117', surface: '#161b22', accent: '#58a6ff', accent2: '#3fb950', text: '#c9d1d9', muted: '#8b949e' },
    [SANS, SANS], 6),
  preset('solarized-dark', 'Solarized Dark', 'developer', 'solarized',
    { bg: '#002b36', surface: '#073642', accent: '#268bd2', accent2: '#2aa198', text: '#eee8d5', muted: '#586e75' },
    [MONO, SANS], 6),

  // ── Corporate / professional ───────────────────────────────────────────────
  preset('corporate-clean', 'Corporate Clean', 'corporate', 'white',
    { bg: '#ffffff', surface: '#f0f4f8', accent: '#0052cc', accent2: '#00b8d9', text: '#172b4d', muted: '#5e6c84' },
    [SANS, SANS], 6),
  preset('pitch-deck-vc', 'Pitch Deck VC', 'corporate', 'black',
    { bg: '#0b1437', surface: '#16204a', accent: '#00d4ff', accent2: '#7c4dff', text: '#ffffff', muted: '#8493c4' },
    [GEOMETRIC, SANS], 10),
  preset('blueprint', 'Blueprint', 'corporate', 'night',
    { bg: '#0a2540', surface: '#13385e', accent: '#00b4d8', accent2: '#90e0ef', text: '#e0f4ff', muted: '#7da3c0' },
    [SANS, SANS], 4),
  preset('executive-navy', 'Executive Navy', 'corporate', 'night',
    { bg: '#1b2a4a', surface: '#26395f', accent: '#c9a227', accent2: '#e0c050', text: '#f5f5f5', muted: '#9aa6c0' },
    [SERIF, SANS], 4),
  preset('finance-green', 'Finance Green', 'corporate', 'white',
    { bg: '#ffffff', surface: '#eef6f0', accent: '#0b6e4f', accent2: '#3fae6e', text: '#13231b', muted: '#5c7165' },
    [SANS, SANS], 6),
  preset('consulting-slate', 'Consulting Slate', 'corporate', 'white',
    { bg: '#ffffff', surface: '#eef1f5', accent: '#34495e', accent2: '#5d6d7e', text: '#1c2833', muted: '#7b8a99' },
    [SANS, SANS], 4),

  // ── Vibrant / creative ─────────────────────────────────────────────────────
  preset('cyberpunk-neon', 'Cyberpunk Neon', 'creative', 'black',
    { bg: '#0d0221', surface: '#1a0b38', accent: '#ff00a0', accent2: '#00f0ff', text: '#f0e9ff', muted: '#7a5fb0' },
    [MONO, SANS], 4),
  preset('sunset-warm', 'Sunset Warm', 'creative', 'blood',
    { bg: '#2b1717', surface: '#43201e', accent: '#ff6b35', accent2: '#f7c548', text: '#fff3e6', muted: '#c79a83' },
    [GEOMETRIC, SANS], 12),
  preset('neo-brutalism', 'Neo Brutalism', 'creative', 'white',
    { bg: '#ffeb3b', surface: '#ffffff', accent: '#000000', accent2: '#ff0000', text: '#000000', muted: '#444444' },
    [GEOMETRIC, GEOMETRIC], 0),
  preset('glassmorphism', 'Glassmorphism', 'creative', 'night',
    { bg: '#1e2a52', surface: 'rgba(255,255,255,0.1)', accent: '#a78bfa', accent2: '#f0abfc', text: '#f5f3ff', muted: '#b4b0d4' },
    [GEOMETRIC, SANS], 16),
  preset('vaporwave', 'Vaporwave', 'creative', 'black',
    { bg: '#2d1b4e', surface: '#3d2766', accent: '#ff71ce', accent2: '#01cdfe', text: '#fffb96', muted: '#b967ff' },
    [MONO, SANS], 8),
  preset('forest-calm', 'Forest Calm', 'creative', 'moon',
    { bg: '#1a2f23', surface: '#26412f', accent: '#7cb342', accent2: '#aed581', text: '#eaf3ea', muted: '#8fa890' },
    [SERIF, SANS], 10),
  preset('ocean-breeze', 'Ocean Breeze', 'creative', 'white',
    { bg: '#e0f7fa', surface: '#b2ebf2', accent: '#00838f', accent2: '#26c6da', text: '#06343b', muted: '#4f7e85' },
    [SANS, SANS], 12),
  preset('coral-pop', 'Coral Pop', 'creative', 'white',
    { bg: '#fff5f3', surface: '#ffe0d9', accent: '#ff5252', accent2: '#ff9e80', text: '#3e1f1a', muted: '#9c7068' },
    [GEOMETRIC, SANS], 14),

  // ── Earthy / muted ─────────────────────────────────────────────────────────
  preset('terracotta', 'Terracotta', 'earthy', 'beige',
    { bg: '#f5ede4', surface: '#e8d5c4', accent: '#c0613f', accent2: '#8a9b6e', text: '#3d2c20', muted: '#8a7560' },
    [SERIF, SANS], 8),
  preset('sage-stone', 'Sage Stone', 'earthy', 'beige',
    { bg: '#f0f0e8', surface: '#dde0d0', accent: '#6b8e6b', accent2: '#a3b18a', text: '#2f3a2f', muted: '#788578' },
    [SANS, SANS], 6),
  preset('autumn-rust', 'Autumn Rust', 'earthy', 'blood',
    { bg: '#2e1d14', surface: '#4a2f1f', accent: '#d2691e', accent2: '#cd853f', text: '#f5e6d3', muted: '#b89070' },
    [SERIF, SANS], 6),
  preset('clay-warm', 'Clay Warm', 'earthy', 'beige',
    { bg: '#faf3eb', surface: '#ecdcc8', accent: '#a0522d', accent2: '#deb887', text: '#3a2a1a', muted: '#8c7355' },
    [SERIF, SERIF], 8),

  // ── High contrast / bold ───────────────────────────────────────────────────
  preset('midnight-gold', 'Midnight Gold', 'bold', 'black',
    { bg: '#0a0a0a', surface: '#1a1a1a', accent: '#ffd700', accent2: '#ffeb99', text: '#ffffff', muted: '#999999' },
    [SERIF, SANS], 4),
  preset('crimson-dark', 'Crimson Dark', 'bold', 'blood',
    { bg: '#1a0808', surface: '#330f0f', accent: '#dc143c', accent2: '#ff6b6b', text: '#fff0f0', muted: '#b08080' },
    [GEOMETRIC, SANS], 6),
  preset('electric-violet', 'Electric Violet', 'bold', 'black',
    { bg: '#13002b', surface: '#250450', accent: '#9d4edd', accent2: '#e0aaff', text: '#f3e9ff', muted: '#9080b0' },
    [GEOMETRIC, SANS], 8),
  preset('hi-contrast-mono', 'Hi-Contrast Mono', 'bold', 'black',
    { bg: '#000000', surface: '#1a1a1a', accent: '#ffffff', accent2: '#cccccc', text: '#ffffff', muted: '#888888' },
    [GEOMETRIC, GEOMETRIC], 0),
]

/** Look up a preset by id; returns null if not found. */
function getThemePreset(id) {
  return THEME_PRESETS.find((p) => p.id === id) || null
}

module.exports = { THEME_PRESETS, getThemePreset }
