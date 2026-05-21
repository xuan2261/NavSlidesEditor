// Issue #3: Insert/Embed adjacent dup. Add SVG must use FileImage; Add drawing
// keeps Pencil. Embed row must have no two adjacent buttons sharing an icon.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.resolve(HERE, 'ribbon-insert-tab-element-galleries-panel.jsx')

function getEmbedSection(content) {
  const start = content.indexOf('label="Embed"')
  expect(start).toBeGreaterThan(0)
  const end = content.indexOf('</RibbonSection>', start)
  expect(end).toBeGreaterThan(start)
  return content.slice(start, end)
}

function extractEmbedButtons(section) {
  // Match `<Icon size={14} />` adjacent to a Button. Use the title to label
  // each entry so adjacency is preserved.
  const re = /title="(Add [^"]+)"[\s\S]*?<([A-Z][A-Za-z0-9]+)\s+size=\{14\}/g
  const out = []
  let m
  while ((m = re.exec(section)) !== null) {
    out.push({ title: m[1], icon: m[2] })
  }
  return out
}

describe('Insert/Embed icon consistency', () => {
  it('Add SVG uses FileImage; Add drawing keeps Pencil', () => {
    const content = readFileSync(FILE, 'utf8')
    const section = getEmbedSection(content)
    const buttons = extractEmbedButtons(section)
    const byTitle = Object.fromEntries(buttons.map((b) => [b.title, b.icon]))
    expect(byTitle['Add SVG']).toBe('FileImage')
    expect(byTitle['Add drawing']).toBe('Pencil')
  })

  it('No two adjacent Embed buttons share an icon', () => {
    const content = readFileSync(FILE, 'utf8')
    const section = getEmbedSection(content)
    const buttons = extractEmbedButtons(section)
    expect(buttons.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < buttons.length; i++) {
      expect(
        buttons[i].icon,
        `${buttons[i - 1].title} and ${buttons[i].title} share icon ${buttons[i].icon}`,
      ).not.toBe(buttons[i - 1].icon)
    }
  })

  it('FileImage is imported from lucide-react', () => {
    const content = readFileSync(FILE, 'utf8')
    const lucideImport = content.match(
      /import\s*\{([\s\S]+?)\}\s*from\s*['"]lucide-react['"]/,
    )
    expect(lucideImport).toBeTruthy()
    expect(lucideImport[1]).toMatch(/\bFileImage\b/)
  })
})
