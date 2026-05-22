// Issues #4 + #5: Design tab Footer toggle uses PanelBottom; the 4 SIZE_PRESETS
// preset buttons each render a distinct Lucide icon; Kiosk-mode keeps
// MonitorSmartphone (orphan ok).

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.resolve(HERE, 'design-tab-content.jsx')

describe('Design tab icon consistency', () => {
  it('Footer toggle uses PanelBottom', () => {
    const content = readFileSync(FILE, 'utf8')
    // Locate the Footer RibbonSection and assert the icon used for the
    // "Toggle footer" button is PanelBottom.
    const start = content.indexOf('label="Footer"')
    expect(start).toBeGreaterThan(0)
    const end = content.indexOf('</RibbonSection>', start)
    const section = content.slice(start, end)
    const m = section.match(
      /aria-label="Toggle footer"[\s\S]*?<([A-Z][A-Za-z0-9]+)\s+size=\{14\}/,
    )
    expect(m).toBeTruthy()
    expect(m[1]).toBe('PanelBottom')
  })

  it('SIZE_PRESETS map renders 4 distinct Lucide icons', () => {
    const content = readFileSync(FILE, 'utf8')
    // Inspect SIZE_PRESETS array
    const presetsBlock = content.match(/const SIZE_PRESETS = \[([\s\S]+?)\]/)
    expect(presetsBlock).toBeTruthy()
    const lines = presetsBlock[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('{'))
    expect(lines.length).toBe(4)
    const icons = []
    for (const l of lines) {
      const m = l.match(/icon:\s*([A-Z][A-Za-z0-9]+)/)
      expect(m, `preset entry should have icon: ${l}`).toBeTruthy()
      icons.push(m[1])
    }
    expect(new Set(icons).size).toBe(4)
    expect(icons).toEqual(
      expect.arrayContaining(['Monitor', 'Square', 'MonitorPlay', 'MonitorSpeaker']),
    )
  })

  it('Kiosk-mode button keeps MonitorSmartphone (orphan ok)', () => {
    const content = readFileSync(FILE, 'utf8')
    const m = content.match(
      /aria-label="Toggle kiosk mode"[\s\S]*?<([A-Z][A-Za-z0-9]+)\s+size=\{14\}/,
    )
    expect(m).toBeTruthy()
    expect(m[1]).toBe('MonitorSmartphone')
  })

  it('Slide Size buttons render the per-preset icon, not a hard-coded MonitorSmartphone', () => {
    const content = readFileSync(FILE, 'utf8')
    const start = content.indexOf('label="Slide Size"')
    expect(start).toBeGreaterThan(0)
    const end = content.indexOf('</RibbonSection>', start)
    const section = content.slice(start, end)
    expect(section).not.toMatch(/<MonitorSmartphone\s+size=\{12\}/)
    expect(section).toMatch(/<\w+\.icon\s+size=\{12\}/)
  })
})
