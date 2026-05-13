import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Toolbar from './Toolbar'

function createEditorStub(activeMarks = {}) {
  const chain = {
    focus: () => chain,
    setTextSelection: () => chain,
    run: () => true,
  }

  return {
    state: {
      selection: { from: 0, to: 0 },
      doc: { content: { size: 0 } },
    },
    chain: () => chain,
    can: () => ({ undo: () => false, redo: () => false }),
    getAttributes: () => ({}),
    isActive: (name, attrs) => {
      if (typeof name === 'object') return false
      if (attrs?.level) return Boolean(activeMarks[`${name}:${attrs.level}`])
      return Boolean(activeMarks[name])
    },
  }
}

function renderToolbar(props = {}) {
  return renderToString(
    <Toolbar
      editor={null}
      showGrid={false}
      onToggleGrid={() => {}}
      gridSize={40}
      onGridSizeChange={() => {}}
      onAddLine={() => {}}
      selectedCount={0}
      smartGuidesEnabled={false}
      onToggleSmartGuides={() => {}}
      showRulers={false}
      onToggleRulers={() => {}}
      {...props}
    />
  )
}

describe('Toolbar accessibility contract', () => {
  it('marks editor chrome toggles with aria-pressed state', () => {
    const html = renderToolbar({
      showGrid: true,
      smartGuidesEnabled: true,
      showRulers: false,
    })

    expect(html).toContain('aria-label="Hide grid / disable snap"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-label="Disable smart guides"')
    expect(html).toContain('aria-pressed="false"')
  })

  it('marks active rich-text commands with aria-pressed state', () => {
    const html = renderToolbar({
      editor: createEditorStub({ bold: true, italic: false }),
    })

    expect(html).toContain('aria-label="Bold (Ctrl+B)"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-label="Italic (Ctrl+I)"')
    expect(html).toContain('aria-pressed="false"')
  })
})
