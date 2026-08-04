import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../components/ribbon/ribbon-panel', () => ({
  default: ({ onPreviewTransition }) => (
    <button type="button" aria-label="Preview transition" onClick={onPreviewTransition}>
      Preview
    </button>
  ),
}))

vi.mock('../../utils/api', () => ({
  api: { uploadFile: vi.fn() },
}))

import EditorRibbon from '../../components/editor/editor-ribbon.jsx'

const editorPagePath = path.resolve(import.meta.dirname, '../EditorPage.jsx')

function createRibbonContext(setShowTransitionPreview) {
  return {
    editingElementId: null,
    presentation: { slides: [] },
    activeSlide: null,
    currentSlide: { elements: [] },
    selectedElement: null,
    selectedElementIds: [],
    editor: null,
    pluginTypes: [],
    viewMode: 'normal',
    setShowTransitionPreview,
  }
}

describe('EditorPage transition preview wiring', () => {
  it('forwards the preview action through EditorRibbon', () => {
    const setShowTransitionPreview = vi.fn()
    render(<EditorRibbon c={createRibbonContext(setShowTransitionPreview)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Preview transition' }))

    expect(setShowTransitionPreview).toHaveBeenCalledWith(true)
  })

  it('selects and forwards the transition preview setter to workspace context', () => {
    const editorPage = fs.readFileSync(editorPagePath, 'utf8')

    expect(editorPage).toMatch(
      /const setShowTransitionPreview = useUIStore\(\(s\) => s\.setShowTransitionPreview\)/,
    )
    expect(editorPage).toMatch(
      /setShowCssEditor, setShowAnimationPreview, setShowTransitionPreview, pluginTypes/,
    )
  })
})
