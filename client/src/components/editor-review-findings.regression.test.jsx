import React, { useState } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import RibbonHeaderBar from './ribbon/ribbon-header-bar'
import { SlideThumbnailPreview } from './slide-panel/slide-thumbnail-preview'
import { useEditorLayoutController } from '../hooks/editor-controller/use-editor-layout-controller'

afterEach(cleanup)

describe('independent editor review regressions', () => {
  it('opens Present through native click activation', () => {
    render(<RibbonHeaderBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Present' }))
    expect(screen.getByRole('menuitem', { name: 'From beginning (F5)' })).toBeTruthy()
  })

  it('does not open Present from the secondary pointer button', () => {
    render(<RibbonHeaderBar />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Present' }), { button: 2 })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('does not mount stylesheets or media runtimes from thumbnail rich content', () => {
    const { container } = render(<SlideThumbnailPreview slide={{ elements: [{ id: 'unsafe', type: 'text', width: 500, height: 100, content: '<style>body{display:none}</style><link rel="stylesheet" href="https://invalid.test/a.css"><audio autoplay src="https://invalid.test/a.mp3"></audio><p>Safe text</p>' }] }} />)
    expect(container.querySelector('style,link,audio,video,iframe,script')).toBeNull()
    expect(screen.getByText('Safe text')).toBeTruthy()
  })

  it('continues editing the visible slide after undo removes the active master', () => {
    const { result } = renderHook(() => {
      const [presentation, setPresentation] = useState({ id: 'deck', slides: [{ id: 'slide', elements: [] }], layoutMasters: [{ id: 'master', name: 'Master', fixedElements: [], placeholders: [] }] })
      const controller = useEditorLayoutController({ presentation, setPresentation, setSelectedElementIds: () => {}, mapActive: (previous, transform) => ({ ...previous, slides: previous.slides.map(transform) }) })
      return { presentation, setPresentation, ...controller }
    })
    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('master'))
    act(() => result.current.setPresentation((previous) => ({ ...previous, layoutMasters: [] })))
    expect(result.current.masterEdit).toBeNull()
    act(() => result.current.setPresentation((previous) => result.current.mapAuthoringTarget(previous, (slide) => ({ ...slide, elements: [{ id: 'added', type: 'text' }] }))))
    expect(result.current.presentation.slides[0].elements).toEqual([{ id: 'added', type: 'text' }])
  })
})
