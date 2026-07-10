import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

const root = cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

describe('verified UI accessibility findings regression guards', () => {
  it('[F6] canvas selection chrome uses tokens instead of raw purple/teal literals', () => {
    const source = read('client/src/components/canvas/canvas-element-wrapper.jsx')

    expect(source).not.toMatch(/#6366f1|#8b5cf6|#14b8a6/i)
    expect(source).toContain('var(--selection)')
    expect(source).toContain('var(--selection-muted)')
  })

  it('[F7] editor right panels do not depend on a fixed 80px offset', () => {
    const source = read('client/src/pages/EditorPage.jsx')

    expect(source).not.toContain('mt-[80px]')
    expect(source).not.toContain('calc(100%-80px)')
  })

  it('[F10] template picker grid adapts below desktop widths', () => {
    const source = read('client/src/components/TemplatePickerModal.jsx')

    expect(source).toContain('grid-cols-1')
    expect(source).toContain('sm:grid-cols-2')
    expect(source).toContain('lg:grid-cols-4')
  })

  it('[F11] media library toolbar can wrap on narrow viewports', () => {
    const source = read('client/src/components/MediaLibraryModal.jsx')

    expect(source).toContain('flex-wrap')
    expect(source).toContain('min-w-[180px]')
    expect(source).toContain('uploadInputRef.current?.click()')
    expect(source).not.toMatch(/<label[\s\S]*Upload[\s\S]*type="file"/)
  })

  it('[F12] structural emoji are not used as UI controls in scoped chrome files', () => {
    const files = [
      'client/src/components/ShareModal.jsx',
      'client/src/components/SlideCanvas.jsx',
    ]

    for (const file of files) {
      expect(read(file)).not.toMatch(/[🔗📋🔒]/u)
    }

    const slidePanel = read('client/src/components/SlidePanel.jsx')
    expect(slidePanel).toContain('aria-hidden="true"')
  })
})
