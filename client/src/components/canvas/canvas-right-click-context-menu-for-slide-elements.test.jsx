import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CanvasContextMenu, { getCopyableMediaUrl } from './canvas-right-click-context-menu-for-slide-elements'

function renderMenu(element, props = {}) {
  const onClose = vi.fn()
  render(
    <CanvasContextMenu
      contextMenu={{ elementId: element.id, elementType: element.type, x: 10, y: 20 }}
      slide={{ elements: [element] }}
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
    expect(getCopyableMediaUrl(
      { src: '//cdn.example.test/video.mp4' },
      'https://slides.test'
    )).toBe('https://cdn.example.test/video.mp4')
    expect(getCopyableMediaUrl(
      { src: 'media/image.png' },
      'https://slides.test/decks/one'
    )).toBe('https://slides.test/decks/media/image.png')
  })

  it('keeps blob and data URLs copyable', () => {
    expect(getCopyableMediaUrl({ src: 'blob:https://slides.test/id' })).toBe('blob:https://slides.test/id')
    expect(getCopyableMediaUrl({ src: 'data:image/png;base64,abc' })).toBe('data:image/png;base64,abc')
  })

  it('rejects executable and unsupported URL schemes', () => {
    expect(getCopyableMediaUrl({ src: 'javascript:alert(1)' }, 'https://slides.test')).toBeNull()
    expect(getCopyableMediaUrl({ src: 'vbscript:msgbox(1)' }, 'https://slides.test')).toBeNull()
    expect(getCopyableMediaUrl({ src: 'file:///C:/secret.png' }, 'https://slides.test')).toBeNull()
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
