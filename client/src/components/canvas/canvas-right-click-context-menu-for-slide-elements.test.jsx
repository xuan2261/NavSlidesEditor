import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CanvasContextMenu, {
  getCopyableMediaUrl,
} from './canvas-right-click-context-menu-for-slide-elements'

function renderMenu(element, props = {}) {
  const onClose = vi.fn()
  const slide = props.slide || { elements: [element] }
  render(
    <CanvasContextMenu
      contextMenu={{ elementId: element.id, elementType: element.type, x: 10, y: 20 }}
      slide={slide}
      onCopy={vi.fn()}
      onCut={vi.fn()}
      onPaste={vi.fn()}
      onDuplicate={vi.fn()}
      onDeleteElement={vi.fn()}
      onUpdateElement={vi.fn()}
      onStartCrop={vi.fn()}
      onClose={onClose}
      {...props}
    />
  )
  return { onClose }
}

describe('CanvasContextMenu copy URL action', () => {
  it('cut invokes only the cut callback and does not directly delete the context target', () => {
    const onCut = vi.fn()
    const onDeleteElement = vi.fn()
    renderMenu({ id: 'shape-1', type: 'shape' }, { onCut, onDeleteElement })

    fireEvent.click(screen.getByRole('button', { name: /Cut/ }))

    expect(onCut).toHaveBeenCalledTimes(1)
    expect(onDeleteElement).not.toHaveBeenCalled()
  })

  it('disables destructive actions for a locked context target', () => {
    const onCopy = vi.fn()
    renderMenu({ id: 'locked-1', type: 'shape', locked: true }, { onCopy })

    expect(screen.getByRole('button', { name: /Cut/ }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Duplicate/ }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Copy \(Ctrl\+C\)/ }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Copy \(Ctrl\+C\)/ }))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('disables mutation actions when the whole slide is locked', () => {
    const onPaste = vi.fn()
    const onUpdateElement = vi.fn()
    renderMenu(
      { id: 'shape-locked-slide', type: 'shape' },
      { slide: { locked: true, elements: [{ id: 'shape-locked-slide', type: 'shape' }] }, onPaste, onUpdateElement }
    )

    expect(screen.getByRole('button', { name: /Cut/ }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Paste/ }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: /Copy \(Ctrl\+C\)/ }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Upper Left' }))

    expect(onPaste).not.toHaveBeenCalled()
    expect(onUpdateElement).not.toHaveBeenCalled()
  })

  it('enables partial mutation actions for a mixed locked context selection', () => {
    const elements = [
      { id: 'free', type: 'shape' },
      { id: 'locked', type: 'shape', locked: true },
    ]
    render(
      <CanvasContextMenu
        contextMenu={{
          elementId: 'free',
          elementType: 'shape',
          contextSelectionIds: ['free', 'locked'],
          x: 10,
          y: 20,
        }}
        slide={{ elements }}
        onCopy={vi.fn()}
        onCut={vi.fn()}
        onPaste={vi.fn()}
        onDuplicate={vi.fn()}
        onUpdateElement={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Cut/ }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: /Duplicate/ }).disabled).toBe(false)
  })

  it('copies an absolute image URL and closes the menu', () => {
    const writeText = vi.fn()
    const { onClose } = renderMenu(
      { id: 'img-1', type: 'image', src: 'https://example.test/image.png' },
      { clipboard: { writeText } }
    )

    fireEvent.click(screen.getByRole('button', { name: /Copy URL/ }))

    expect(writeText).toHaveBeenCalledWith('https://example.test/image.png')
    expect(onClose).toHaveBeenCalled()
  })

  it('normalizes local video URLs before copying', () => {
    const writeText = vi.fn()
    renderMenu(
      { id: 'vid-1', type: 'video', src: '/uploads/video.mp4' },
      { clipboard: { writeText }, origin: 'https://slides.test' }
    )

    fireEvent.click(screen.getByRole('button', { name: /Copy URL/ }))

    expect(writeText).toHaveBeenCalledWith('https://slides.test/uploads/video.mp4')
  })

  it('normalizes protocol-relative and relative media URLs against the origin', () => {
    expect(
      getCopyableMediaUrl({ src: '//cdn.example.test/video.mp4' }, 'https://slides.test')
    ).toBe('https://cdn.example.test/video.mp4')
    expect(getCopyableMediaUrl({ src: 'media/image.png' }, 'https://slides.test/decks/one')).toBe(
      'https://slides.test/decks/media/image.png'
    )
  })

  it('keeps blob and data URLs copyable', () => {
    expect(getCopyableMediaUrl({ src: 'blob:https://slides.test/id' })).toBe(
      'blob:https://slides.test/id'
    )
    expect(getCopyableMediaUrl({ src: 'data:image/png;base64,abc' })).toBe(
      'data:image/png;base64,abc'
    )
  })

  it('rejects executable and unsupported URL schemes', () => {
    expect(getCopyableMediaUrl({ src: 'javascript:alert(1)' }, 'https://slides.test')).toBeNull()
    expect(getCopyableMediaUrl({ src: 'vbscript:msgbox(1)' }, 'https://slides.test')).toBeNull()
    expect(getCopyableMediaUrl({ src: 'file:///C:/secret.png' }, 'https://slides.test')).toBeNull()
    expect(
      getCopyableMediaUrl(
        { src: 'data:text/html,<script>alert(1)</script>' },
        'https://slides.test'
      )
    ).toBeNull()
  })

  it('hides Copy URL for media without a usable source', () => {
    renderMenu({ id: 'img-2', type: 'image' })

    expect(screen.queryByRole('button', { name: /Copy URL/ })).toBeNull()
  })

  it('hides Copy URL for non-media elements', () => {
    renderMenu({ id: 'text-1', type: 'text', src: 'https://example.test/not-media.png' })

    expect(screen.queryByRole('button', { name: /Copy URL/ })).toBeNull()
  })

  it('closes the menu when clipboard throws synchronously', () => {
    const writeText = vi.fn(() => {
      throw new Error('clipboard unavailable')
    })
    const { onClose } = renderMenu(
      { id: 'img-3', type: 'image', src: 'https://example.test/image.png' },
      { clipboard: { writeText } }
    )

    fireEvent.click(screen.getByRole('button', { name: /Copy URL/ }))

    expect(writeText).toHaveBeenCalledWith('https://example.test/image.png')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('icon consistency pass — Lucide ctx-menu', () => {
  const ICON_GLYPHS = ['↖', '↑', '↗', '←', '⊕', '→', '↙', '↓', '↘', '↺', '⧉']

  function getMenuRoot() {
    // Container is the fixed positioned div with z-[9999].
    return document.querySelector('div[class*="z-[9999]"]')
  }

  it('top-level item buttons render Lucide SVG (no emoji, no unicode arrows)', () => {
    renderMenu({ id: 'rect-1', type: 'shape' })
    const root = getMenuRoot()
    expect(root).toBeTruthy()
    const text = root?.textContent || ''
    // Extended_Pictographic catches 📋 ✂ 📌 and similar emoji code points.
    expect(text.match(/\p{Extended_Pictographic}/gu) || []).toEqual([])
    for (const glyph of ICON_GLYPHS) {
      expect(text).not.toContain(glyph)
    }
    // Lucide-react renders <svg class="lucide ..."> — every top-level menu
    // item button now contains at least one such svg.
    const topLevelButtons = root?.querySelectorAll(':scope > button') || []
    expect(topLevelButtons.length).toBeGreaterThan(0)
    for (const btn of topLevelButtons) {
      expect(btn.querySelector('svg.lucide')).toBeTruthy()
    }
  })

  it('image element variant exposes Crop and Reset crop with Lucide icons', () => {
    renderMenu({ id: 'img-x', type: 'image', src: 'https://example.test/x.png' })
    const cropBtn = screen.getByRole('button', { name: /^Crop$/ })
    const resetBtn = screen.getByRole('button', { name: /Reset crop/ })
    expect(cropBtn.querySelector('svg.lucide')).toBeTruthy()
    expect(resetBtn.querySelector('svg.lucide')).toBeTruthy()
    // No raw glyphs in the rendered text content.
    expect(cropBtn.textContent || '').not.toContain('✂')
    expect(resetBtn.textContent || '').not.toContain('↺')
  })

  it('SNAP grid renders 9 Lucide icons and keeps aria-labels (Upper/Middle/Lower × Left/Center/Right)', () => {
    renderMenu({ id: 'rect-2', type: 'shape' })
    const root = getMenuRoot()
    const snapLabel = Array.from(root?.querySelectorAll('div') || []).find(
      (d) => d.textContent === 'Snap Reference'
    )
    expect(snapLabel).toBeTruthy()
    const grid = snapLabel?.nextElementSibling
    const cells = grid?.querySelectorAll('button') || []
    expect(cells.length).toBe(9)
    for (const cell of cells) {
      expect(cell.querySelector('svg.lucide')).toBeTruthy()
      // accessible name comes from `title` attribute (Upper Left etc.)
      const title = cell.getAttribute('title') || ''
      expect(title.length).toBeGreaterThan(0)
      // No legacy unicode arrows leaking through.
      const text = cell.textContent || ''
      for (const glyph of ICON_GLYPHS) {
        expect(text).not.toContain(glyph)
      }
    }
  })
})
