// Issue #3: Insert/Embed adjacent dup. Add SVG must use FileImage; Add drawing
// keeps Pencil. Embed row must have no two adjacent buttons sharing an icon.

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InsertTabContent from './ribbon-insert-tab-element-galleries-panel.jsx'
import { api } from '../../utils/api'
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

describe('Insert icon semantic accuracy', () => {
  function iconByAriaLabel(content, ariaLabel) {
    const re = new RegExp(
      `aria-label="${ariaLabel}"[\\s\\S]*?<([A-Z][A-Za-z0-9]+)\\s+size=\\{14\\}`,
    )
    const m = content.match(re)
    expect(m, `button "${ariaLabel}" should render a sized lucide icon`).toBeTruthy()
    return m[1]
  }

  it('Icon element button uses Sticker, not the emoji-specific Smile', () => {
    const content = readFileSync(FILE, 'utf8')
    expect(iconByAriaLabel(content, 'Add icon')).toBe('Sticker')
    expect(content).not.toMatch(/<Smile\s+size=\{14\}/)
  })

  it('Open file browser uses HardDrive, not Monitor', () => {
    const content = readFileSync(FILE, 'utf8')
    expect(iconByAriaLabel(content, 'Open file browser')).toBe('HardDrive')
  })

  it('Divider uses SeparatorHorizontal, not Scissors (which means Cut)', () => {
    const content = readFileSync(FILE, 'utf8')
    expect(iconByAriaLabel(content, 'Add divider')).toBe('SeparatorHorizontal')
    expect(content).not.toMatch(/<Scissors\s+size=\{14\}/)
  })

  it('imports the replacement icons from lucide-react', () => {
    const content = readFileSync(FILE, 'utf8')
    const lucideImport = content.match(
      /import\s*\{([\s\S]+?)\}\s*from\s*['"]lucide-react['"]/,
    )
    expect(lucideImport).toBeTruthy()
    expect(lucideImport[1]).toMatch(/\bSticker\b/)
    expect(lucideImport[1]).toMatch(/\bHardDrive\b/)
    expect(lucideImport[1]).toMatch(/\bSeparatorHorizontal\b/)
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

describe('Technical symbol packs gallery', () => {
  it('[cap:teaching.discovery depth:a11y] exposes teaching insert controls with helper descriptions', () => {
    render(<InsertTabContent pluginTypes={[]} />)

    const expected = [
      ['Add Mermaid diagram', /flowcharts and sequence diagrams/i],
      ['Add STEM simulation', /PhET, GeoGebra, Desmos, or CircuitJS/i],
      ['Add LaTeX / TikZ', /math formulas and TikZ diagrams/i],
      ['Technical symbols', /UML, network, circuit, and cloud symbols/i],
      ['More advanced insert options', /classroom games and plugin inserts/i],
    ]

    for (const [name, helperPattern] of expected) {
      const button = screen.getByRole('button', { name })
      const descriptionId = button.getAttribute('aria-describedby')
      expect(descriptionId, `${name} should reference helper copy`).toBeTruthy()
      expect(document.getElementById(descriptionId).textContent).toMatch(helperPattern)
    }
  })

  it('[cap:element.svg depth:behavior] shows UML, network, circuit, and cloud packs', () => {
    render(<InsertTabContent pluginTypes={[]} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Technical symbols' }))
    const popup = document.body.querySelector('[data-ribbon-popup="technical-symbol-gallery"]')
    expect(popup).toBeTruthy()

    for (const label of ['UML', 'Network', 'Circuit', 'Cloud']) {
      expect(Array.from(popup.querySelectorAll('div')).some((node) => node.textContent === label)).toBe(true)
    }
  })

  it('[cap:element.svg depth:behavior] inserts selected technical symbols through existing element types', () => {
    const onAddTechnicalSymbol = vi.fn()
    render(<InsertTabContent pluginTypes={[]} onAddTechnicalSymbol={onAddTechnicalSymbol} />)

    const launcher = screen.getByRole('button', { name: 'Technical symbols' })
    fireEvent.mouseDown(launcher)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Class' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Class' }))

    expect(onAddTechnicalSymbol).toHaveBeenCalledWith('uml-class')
    expect(document.activeElement).toBe(launcher)
  })
})

describe('Table size picker ergonomics', () => {
  it('uses one grid tab stop and supports keyboard selection', () => {
    const onAddTable = vi.fn()
    render(<InsertTabContent pluginTypes={[]} onAddTable={onAddTable} />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add table' }))

    const grid = screen.getByRole('grid', { name: /Table size 3 by 3/i })
    expect(grid.tabIndex).toBe(0)
    expect(screen.getAllByRole('gridcell')).toHaveLength(48)
    expect(screen.getAllByRole('gridcell').every((cell) => cell.tabIndex === -1)).toBe(true)

    fireEvent.keyDown(grid, { key: 'ArrowRight' })
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    fireEvent.keyDown(grid, { key: 'Enter' })
    expect(onAddTable).toHaveBeenCalledWith(4, 4)
  })
})

describe('Insert upload error handling', () => {
  it('shows a recoverable error when picture upload rejects', async () => {
    let openedInput
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      openedInput = this
    })
    const onAddImageUpload = vi.fn().mockRejectedValue(new Error('network down'))
    render(<InsertTabContent pluginTypes={[]} onAddImageUpload={onAddImageUpload} />)

    fireEvent.click(screen.getByRole('button', { name: 'Picture' }))
    const input = openedInput
    expect(input).toBeTruthy()
    fireEvent.change(input, { target: { files: [new File(['image'], 'slide.png', { type: 'image/png' })] } })

    await waitFor(() => expect(screen.getByText('Upload failed. Check your connection.')).toBeTruthy())
    expect(onAddImageUpload).toHaveBeenCalledTimes(1)
    inputClick.mockRestore()
  })

  it('preserves picture cancellation feedback when the target slide changes', async () => {
    let openedInput
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      openedInput = this
    })
    const onAddImageUpload = vi.fn().mockRejectedValue(
      new Error('Upload canceled because the active slide changed')
    )
    render(<InsertTabContent pluginTypes={[]} activeSlideId="slide-a" onAddImageUpload={onAddImageUpload} />)

    fireEvent.click(screen.getByRole('button', { name: 'Picture' }))
    fireEvent.change(openedInput, {
      target: { files: [new File(['image'], 'slide.png', { type: 'image/png' })] },
    })

    await waitFor(() => expect(screen.getByText('Upload canceled because the active slide changed')).toBeTruthy())
    inputClick.mockRestore()
  })

  it('does not insert media after the active slide changes during upload', async () => {
    let openedInput
    let resolveUpload
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve
    })
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      openedInput = this
    })
    const uploadSpy = vi.spyOn(api, 'uploadFile').mockReturnValue(uploadPromise)
    const onAddAudio = vi.fn()
    const props = { pluginTypes: [], activeSlideId: 'slide-a', onAddAudio }
    const { rerender } = render(<InsertTabContent {...props} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Audio / Upload' }))
    fireEvent.change(openedInput, {
      target: { files: [new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })] },
    })
    rerender(<InsertTabContent {...props} activeSlideId="slide-b" />)

    await act(async () => {
      resolveUpload({ url: '/track.mp3' })
    })

    await waitFor(() => expect(screen.getByText('Upload canceled because the active slide changed')).toBeTruthy())
    expect(onAddAudio).not.toHaveBeenCalled()
    uploadSpy.mockRestore()
    inputClick.mockRestore()
  })

  it('does not insert SVG after the active slide changes while reading', async () => {
    let openedInput
    let resolveText
    const textPromise = new Promise((resolve) => {
      resolveText = resolve
    })
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      openedInput = this
    })
    const onAddSvg = vi.fn()
    const props = { pluginTypes: [], activeSlideId: 'slide-a', onAddSvg }
    const { rerender } = render(<InsertTabContent {...props} />)
    const svgFile = new File(['<svg />'], 'drawing.svg', { type: 'image/svg+xml' })
    Object.defineProperty(svgFile, 'text', { value: () => textPromise })

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add SVG' }))
    fireEvent.change(openedInput, { target: { files: [svgFile] } })
    rerender(<InsertTabContent {...props} activeSlideId="slide-b" />)

    await act(async () => {
      resolveText('<svg />')
    })

    await waitFor(() => expect(screen.getByText('Upload canceled because the active slide changed')).toBeTruthy())
    expect(onAddSvg).not.toHaveBeenCalled()
    inputClick.mockRestore()
  })
})
