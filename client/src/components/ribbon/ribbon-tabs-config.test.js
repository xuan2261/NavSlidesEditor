// Tab icons must be unique per tab and must not reuse a glyph that also labels
// an in-tab command (Wand2 = Animation type inside Animations; Clapperboard =
// Anime.js inside Insert). Transitions → Replace, Animations → Sparkles.

import { describe, expect, it } from 'vitest'
import { ELEMENT_DEFAULTS } from '../../data/element-defaults'
import {
  FORMAT_RIBBON_CONTEXTUAL_TYPES,
  FORMAT_RIBBON_ELEMENT_POLICY,
  RIBBON_TABS,
  formatTabLabel,
} from './ribbon-tabs-config'

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

describe('formatTabLabel', () => {
  it('maps each element type to its PowerPoint-style contextual label', () => {
    expect(formatTabLabel('shape')).toBe('Shape Format')
    expect(formatTabLabel('line')).toBe('Shape Format')
    expect(formatTabLabel('image')).toBe('Picture Format')
    expect(formatTabLabel('table')).toBe('Table Design')
    expect(formatTabLabel('chart')).toBe('Chart Design')
    expect(formatTabLabel('code')).toBe('Code')
    expect(formatTabLabel('video')).toBe('Media')
    expect(formatTabLabel('audio')).toBe('Media')
  })

  it('falls back to "Format" for text and unknown types', () => {
    expect(formatTabLabel('text')).toBe('Format')
    expect(formatTabLabel(null)).toBe('Format')
    expect(formatTabLabel(undefined)).toBe('Format')
    expect(formatTabLabel('something-new')).toBe('Format')
  })

  it('has an explicit Format ribbon policy for every canonical element type', () => {
    expect(Object.keys(FORMAT_RIBBON_ELEMENT_POLICY).sort()).toEqual(
      Object.keys(ELEMENT_DEFAULTS).sort()
    )
  })

  it('labels every canonical element by dedicated label or documented default', () => {
    for (const type of Object.keys(ELEMENT_DEFAULTS)) {
      expect(formatTabLabel(type)).toBe(FORMAT_RIBBON_ELEMENT_POLICY[type].label)
    }
  })

  it('documents alternate surfaces for accepted Format ribbon limits', () => {
    const verifiedAlternateSurfaces = [
      'PropertiesPanel',
      'direct canvas editing',
      'Home typography controls',
      'game PropertiesPanel',
    ]

    for (const [type, policy] of Object.entries(FORMAT_RIBBON_ELEMENT_POLICY)) {
      expect(['contextual-controls', 'accepted-limit']).toContain(policy.status)
      if (policy.status === 'accepted-limit') {
        expect(
          verifiedAlternateSurfaces.some((surface) => policy.alternateSurface.includes(surface)),
          `${type} accepted-limit must name a verified alternate surface`
        ).toBe(true)
      }
    }
  })

  it('keeps contextual control coverage explicit', () => {
    expect(FORMAT_RIBBON_CONTEXTUAL_TYPES.sort()).toEqual(
      ['shape', 'line', 'image', 'chart', 'table', 'video', 'audio', 'code'].sort()
    )
  })
})
