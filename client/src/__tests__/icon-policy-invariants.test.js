// Source-scan regression guard for the icon-consistency-pass PR.
// Each `it` asserts one post-merge invariant by reading source files directly.
// Starts failing on master (current state has all violations) and flips green
// as the implementation phases land.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_DIR = path.resolve(__dirname, '..')

function toPosix(p) {
  return p.split(path.sep).join('/')
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, files)
    } else if (/\.(jsx?|tsx?)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

const ALL_SRC_FILES = walk(SRC_DIR)
const NON_TEST_SRC_FILES = ALL_SRC_FILES.filter(
  (f) => !/\.test\.(jsx?|tsx?)$/.test(f),
)

const SPARKLES_NON_TEST_WHITELIST = [
  'pages/HomePage.jsx',
  'components/AIGeneratorModal.jsx',
  'components/AICopywriterModal.jsx',
  'components/ribbon/ribbon-header-bar.jsx',
  // The ribbon tab-icon refactor intentionally assigns Sparkles to the
  // Animations tab (Transitions → Replace), codified in ribbon-tabs-config.test.js.
  // That decision postdates this guard, so the config file is allowed.
  'components/ribbon/ribbon-tabs-config.js',
]

function isSparklesAllowed(file) {
  if (/\.test\.(jsx?|tsx?)$/.test(file)) return true
  const rel = toPosix(path.relative(SRC_DIR, file))
  return SPARKLES_NON_TEST_WHITELIST.includes(rel)
}

const CTX_MENU_FILE = path.join(
  SRC_DIR,
  'components',
  'canvas',
  'canvas-right-click-context-menu-for-slide-elements.jsx',
)
const QUICK_ACCESS_FILE = path.join(
  SRC_DIR,
  'components',
  'QuickAccessToolbar.jsx',
)

describe('icon-policy invariants', () => {
  it('canvas ctx-menu has no emoji or unicode-arrow icons', () => {
    const content = readFileSync(CTX_MENU_FILE, 'utf8')

    // Extended_Pictographic catches 📋 ✂ 📌 and similar emoji code points.
    const emojiMatches = content.match(/\p{Extended_Pictographic}/gu) || []

    // Unicode glyphs used historically as icons in this file (arrows + math
    // operators that stood in for Lucide icons before this PR).
    const ICON_GLYPHS = ['↖', '↑', '↗', '←', '⊕', '→', '↙', '↓', '↘', '↺', '⧉']
    const glyphMatches = ICON_GLYPHS.filter((c) => content.includes(c))

    expect({ emoji: emojiMatches, glyphs: glyphMatches }).toEqual({
      emoji: [],
      glyphs: [],
    })
  })

  it('QuickAccessToolbar has no inline <svg>', () => {
    const content = readFileSync(QUICK_ACCESS_FILE, 'utf8')
    const inlineSvg = content.match(/<svg[\s>]/g) || []
    expect(inlineSvg).toEqual([])
  })

  it('Sparkles is confined to AI files + test fixtures', () => {
    const offenders = []
    for (const file of ALL_SRC_FILES) {
      if (isSparklesAllowed(file)) continue
      const content = readFileSync(file, 'utf8')
      if (/\bSparkles\b/.test(content)) {
        offenders.push(toPosix(path.relative(SRC_DIR, file)))
      }
    }
    expect(offenders).toEqual([])
  })

  it('BarChart2 has zero usage in client/src (excluding tests)', () => {
    const offenders = []
    for (const file of NON_TEST_SRC_FILES) {
      const content = readFileSync(file, 'utf8')
      if (/\bBarChart2\b/.test(content)) {
        offenders.push(toPosix(path.relative(SRC_DIR, file)))
      }
    }
    expect(offenders).toEqual([])
  })

  it('all lucide-react Image imports use the ImageIcon alias', () => {
    const offenders = []
    for (const file of ALL_SRC_FILES) {
      const content = readFileSync(file, 'utf8')
      const importStmts =
        content.match(/import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"]/g) || []
      for (const stmt of importStmts) {
        const inner = stmt.match(/\{([^}]+)\}/)?.[1] ?? ''
        const idents = inner.split(',').map((s) => s.trim()).filter(Boolean)
        const bareImage = idents.some((id) => /^Image$/.test(id))
        if (bareImage) {
          offenders.push(toPosix(path.relative(SRC_DIR, file)))
          break
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
