// Sparkles semantic separation regression guard.
// Sparkles is reserved for AI features only post-merge. Wand2 covers
// animation/effect/transition/Auto-Animate/Kinetic Text. LayoutTemplate
// covers Insert Template entry points. Each `it` pins the icon by component
// identity (===) where possible, source-scanning the file otherwise.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Sparkles, Wand2 } from 'lucide-react'

import { RIBBON_TABS } from '../components/ribbon/ribbon-tabs-config'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = path.resolve(HERE, '..')

function readSrc(rel) {
  return readFileSync(path.resolve(SRC_ROOT, rel), 'utf8')
}

describe('sparkles semantic separation', () => {
  it('Transitions ribbon tab uses Wand2', () => {
    const transitions = RIBBON_TABS.find((t) => t.id === 'transitions')
    expect(transitions?.icon).toBe(Wand2)
    expect(transitions?.icon).not.toBe(Sparkles)
  })

  it('Animations Effect picker icon source uses Wand2 (not Sparkles)', () => {
    const content = readSrc(
      'components/ribbon/ribbon-element-animation-effect-controls-tab-content.jsx',
    )
    expect(content).toMatch(/\bWand2\b/)
    expect(content).not.toMatch(/\bSparkles\b/)
  })

  it('Insert tab Advanced "Kinetic Text" item uses Wand2 (not Sparkles)', () => {
    const content = readSrc(
      'components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx',
    )
    const kineticLine = content
      .split('\n')
      .find((l) => /id:\s*'kinetic'/.test(l))
    expect(kineticLine).toBeTruthy()
    expect(kineticLine).toMatch(/icon:\s*Wand2/)
    expect(kineticLine).not.toMatch(/icon:\s*Sparkles/)
  })

  it('SlidePanel autoAnimate badge + ctx-menu item + Insert Template use Wand2/LayoutTemplate', () => {
    const content = readSrc('components/SlidePanel.jsx')
    expect(content).not.toMatch(/\bSparkles\b/)
    expect(content).toMatch(/<Wand2\s+size=\{9\}/)
    expect(content).toMatch(/<Wand2\s+size=\{14\}/)
    expect(content).toMatch(/<LayoutTemplate\s+size=\{14\}/)
  })

  it('AI modules still import Sparkles (regression guard for AI use case)', () => {
    const aiFiles = [
      'components/AICopywriterModal.jsx',
      'components/AIGeneratorModal.jsx',
      'components/ribbon/ribbon-header-bar.jsx',
      'pages/HomePage.jsx',
    ]
    for (const rel of aiFiles) {
      const content = readSrc(rel)
      expect(content, `expected ${rel} to keep Sparkles`).toMatch(/\bSparkles\b/)
    }
  })
})
