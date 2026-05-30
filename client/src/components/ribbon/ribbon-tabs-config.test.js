// Tab icons must be unique per tab and must not reuse a glyph that also labels
// an in-tab command (Wand2 = Animation type inside Animations; Clapperboard =
// Anime.js inside Insert). Transitions → Replace, Animations → Sparkles.

import { describe, expect, it } from 'vitest'
import { RIBBON_TABS } from './ribbon-tabs-config'

function iconName(tab) {
  // lucide-react@0.441 sets Component.displayName = iconName
  return tab.icon?.displayName || tab.icon?.name
}

describe('Ribbon tab icon config', () => {
  it('defines the 7 expected tabs', () => {
    expect(RIBBON_TABS.map((t) => t.id)).toEqual([
      'home', 'insert', 'design', 'format', 'transitions', 'animations', 'view',
    ])
  })

  it('every tab has a resolvable lucide icon', () => {
    for (const tab of RIBBON_TABS) {
      expect(iconName(tab), `tab "${tab.id}" must have an icon`).toBeTruthy()
    }
  })

  it('no two tabs share the same icon', () => {
    const names = RIBBON_TABS.map(iconName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('Transitions tab uses Replace, not Wand2', () => {
    const tab = RIBBON_TABS.find((t) => t.id === 'transitions')
    expect(iconName(tab)).toBe('Replace')
  })

  it('Animations tab uses Sparkles, not Clapperboard', () => {
    const tab = RIBBON_TABS.find((t) => t.id === 'animations')
    expect(iconName(tab)).toBe('Sparkles')
  })

  it('does not reuse in-tab command glyphs (Wand2, Clapperboard) as tab icons', () => {
    const names = RIBBON_TABS.map(iconName)
    expect(names).not.toContain('Wand2')
    expect(names).not.toContain('Clapperboard')
  })
})
