import { SUPPORTED_REVEAL_THEMES, getThemePreset } from 'revealjs-shared'

export const THEMES = SUPPORTED_REVEAL_THEMES || []
export const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

// Maps each deck-starter preset to a token preset id (theme-presets.js) so a
// new deck seeds the matching designTokens. Palette literals live only in
// theme-presets.js (no duplication here).
const PRESET_THEME_TOKEN_IDS = {
  'deck-blank-light': 'minimal-white',
  'deck-blank-dark': 'minimal-dark',
  'deck-palette': 'ocean-breeze',
  'deck-bento': 'corporate-clean',
  'deck-serif': 'editorial-serif',
  'deck-bold': 'crimson-dark',
  'deck-minimal': 'soft-gray',
  'deck-code': 'tokyo-night',
  'deck-desk': 'executive-navy',
  'deck-ellipse': 'coral-pop',
}

const PRESET_THEMES_BASE = [
  {
    id: 'deck-blank-light',
    title: 'Blank Light',
    category: 'minimal',
    theme: 'white',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#ffffff' },
    description: 'Clean minimal light theme',
  },
  {
    id: 'deck-blank-dark',
    title: 'Blank Dark',
    category: 'minimal',
    theme: 'black',
    transition: 'fade',
    thumbnail: { type: 'color', color: '#111111' },
    description: 'Clean minimal dark theme',
  },
  {
    id: 'deck-palette',
    title: 'Palette',
    category: 'creative',
    theme: 'solarized',
    transition: 'zoom',
    thumbnail: { type: 'color', color: '#fdf6e3' },
    description: 'Vibrant and creative colors',
  },
  {
    id: 'deck-bento',
    title: 'Bento',
    category: 'creative',
    theme: 'white',
    transition: 'convex',
    thumbnail: { type: 'gradient', gradient: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' },
    description: 'Grid-based bento box design',
  },
  {
    id: 'deck-serif',
    title: 'Serif',
    category: 'academic',
    theme: 'serif',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#fcfcfc' },
    description: 'Classic typography for reading',
  },
  {
    id: 'deck-bold',
    title: 'Bold',
    category: 'corporate',
    theme: 'blood',
    transition: 'none',
    thumbnail: { type: 'color', color: '#222222' },
    description: 'High contrast for impact',
  },
  {
    id: 'deck-minimal',
    title: 'Minimalist',
    category: 'minimal',
    theme: 'simple',
    transition: 'fade',
    thumbnail: { type: 'color', color: '#fafafa' },
    description: 'Focus entirely on content',
  },
  {
    id: 'deck-code',
    title: 'Code',
    category: 'engineering',
    theme: 'night',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#1a1b26' },
    description: 'Developer focused template',
  },
  {
    id: 'deck-desk',
    title: 'Desk',
    category: 'corporate',
    theme: 'league',
    transition: 'slide',
    thumbnail: { type: 'color', color: '#2b2b2b' },
    description: 'Professional office environment',
  },
  {
    id: 'deck-ellipse',
    title: 'Ellipse',
    category: 'creative',
    theme: 'sky',
    transition: 'concave',
    thumbnail: { type: 'gradient', gradient: 'radial-gradient(circle, #f6f8fd, #e9eff9)' },
    description: 'Soft rounded shapes',
  },
]

// Seed each preset with the matching token set so a new deck starts themed.
export const PRESET_THEMES = PRESET_THEMES_BASE.map((p) => {
  const tokenId = PRESET_THEME_TOKEN_IDS[p.id]
  const preset = tokenId ? getThemePreset(tokenId) : null
  return preset ? { ...p, designTokens: preset.tokens } : p
})

export const TEMPLATE_CATEGORIES = [
  'All',
  'Creative',
  'Academic',
  'Corporate',
  'Kỹ thuật số',
  'Vi xử lý',
  'Lý thuyết mạch',
  'Điện tử',
  'Tự động hoá',
  'Điện',
  'Đo lường',
  'ĐTCS',
  'Cơ khí',
  'VKT',
  'Thuỷ khí',
]

export const LIGHT_PRESET_COLORS = new Set(['#ffffff', '#fafafa', '#fcfcfc'])
