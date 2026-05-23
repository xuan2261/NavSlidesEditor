// Issue #3: Insert/Embed adjacent dup. Add SVG must use FileImage; Add drawing
// keeps Pencil. Embed row must have no two adjacent buttons sharing an icon.

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InsertTabContent from './ribbon-insert-tab-element-galleries-panel.jsx'
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

describe('Insert Advanced direct action contract', () => {
  it('renders fixed Advanced commands as direct buttons outside the launcher menu', () => {
    render(<InsertTabContent pluginTypes={[]} />)

    for (const label of [
      'Add kinetic text',
      'Add math grid',
      'Add Anime.js',
      'Add Three.js',
      'Add timeline',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
      expect(screen.queryByRole('menuitem', { name: label })).toBeNull()
    }

    fireEvent.mouseDown(screen.getByRole('button', { name: 'More advanced insert options' }))

    expect(screen.getByRole('menuitem', { name: 'Games...' })).toBeTruthy()
    for (const oldMenuLabel of ['Kinetic Text', 'Math Grid', 'Anime.js', 'Three.js', 'Timeline']) {
      expect(screen.queryByRole('menuitem', { name: oldMenuLabel })).toBeNull()
    }
  })

  it('fires fixed Advanced callbacks from direct buttons', () => {
    const callbacks = {
      onAddKineticText: vi.fn(),
      onAddMathGrid: vi.fn(),
      onAddAnime: vi.fn(),
      onAddThree: vi.fn(),
      onAddTimeline: vi.fn(),
    }
    render(<InsertTabContent {...callbacks} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add kinetic text' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Add math grid' }), { key: 'Enter' })
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add Anime.js' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add Three.js' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add timeline' }))

    expect(callbacks.onAddKineticText).toHaveBeenCalledTimes(1)
    expect(callbacks.onAddMathGrid).toHaveBeenCalledTimes(1)
    expect(callbacks.onAddAnime).toHaveBeenCalledTimes(1)
    expect(callbacks.onAddThree).toHaveBeenCalledTimes(1)
    expect(callbacks.onAddTimeline).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the Advanced launcher after selecting a game', () => {
    const onAddGame = vi.fn()
    render(<InsertTabContent onAddGame={onAddGame} pluginTypes={[]} />)

    const launcher = screen.getByRole('button', { name: 'More advanced insert options' })
    fireEvent.mouseDown(launcher)
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Games...' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Name Picker' }))

    expect(onAddGame).toHaveBeenCalledWith('name-picker')
    expect(document.activeElement).toBe(launcher)
    expect(screen.queryByRole('button', { name: 'Name Picker' })).toBeNull()
  })
})

describe('Shape gallery preview icons', () => {
  function openShapeGallery() {
    render(<InsertTabContent pluginTypes={[]} />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert shape' }))
  }

  it('renders shape-specific primitives, not identical fallback rectangles', () => {
    openShapeGallery()
    const popup = document.body.querySelector('[data-ribbon-popup="shape-gallery"]')
    expect(popup, 'shape gallery popup must be in DOM').toBeTruthy()

    const circleBtn = popup.querySelector('button[aria-label="Circle"]')
    const triangleBtn = popup.querySelector('button[aria-label="Triangle"]')
    const lineBtn = popup.querySelector('button[aria-label="Line"]')
    const starBtn = popup.querySelector('button[aria-label="Star"]')

    expect(circleBtn?.querySelector('ellipse'), 'Circle preview must render <ellipse>').toBeTruthy()
    expect(triangleBtn?.querySelector('polygon'), 'Triangle preview must render <polygon>').toBeTruthy()
    expect(lineBtn?.querySelector('line'), 'Line preview must render <line>').toBeTruthy()
    expect(starBtn?.querySelector('polygon'), 'Star preview must render <polygon>').toBeTruthy()
  })

  it('does not fall back to identical empty rectangles for every shape', () => {
    openShapeGallery()
    const popup = document.body.querySelector('[data-ribbon-popup="shape-gallery"]')
    const buttons = popup.querySelectorAll('button[aria-label]')
    expect(buttons.length).toBeGreaterThan(10)

    const primitives = Array.from(buttons).map((b) => {
      const svg = b.querySelector('svg')
      const child = svg?.firstElementChild?.tagName?.toLowerCase()
      // shapeSvgString wraps fillable shapes in <g>, so peek inside <g>
      if (child === 'g') return svg.firstElementChild.firstElementChild?.tagName?.toLowerCase()
      return child
    })
    const unique = new Set(primitives.filter(Boolean))
    expect(unique.size, `expected multiple distinct primitives, got ${[...unique]}`).toBeGreaterThan(2)
  })
})
