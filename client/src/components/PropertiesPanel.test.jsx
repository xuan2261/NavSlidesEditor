import React from 'react'
import { renderToString } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
import { computeAccessibleName } from 'dom-accessibility-api'
import { describe, expect, it, vi } from 'vitest'
import PropertiesPanel from './PropertiesPanel'

const baseSlide = {
  id: 'slide-1',
  elements: [],
  notes: '',
}

const shapeElement = {
  id: 'shape-1',
  type: 'shape',
  shape: 'rectangle',
  x: 10,
  y: 20,
  width: 200,
  height: 100,
  rotation: 0,
}

describe('PropertiesPanel warm editor contract', () => {
  it('[cap:control.properties.panel] renders as a labelled complementary panel', () => {
    const html = renderToString(<PropertiesPanel slide={baseSlide} />)

    expect(html).toContain('role="complementary"')
    expect(html).toContain('aria-label="Properties panel"')
  })

  it('uses icon-backed controls instead of structural emoji for common actions', () => {
    const html = renderToString(
      <PropertiesPanel
        slide={{ ...baseSlide, elements: [shapeElement] }}
        selectedElement={shapeElement}
        selectedElementIds={[shapeElement.id]}
        onUpdateElement={() => {}}
        onBringForward={() => {}}
        onSendBackward={() => {}}
        onDeleteElement={() => {}}
      />
    )

    expect(html).toContain('Lock element')
    expect(html).toContain('Forward')
    expect(html).toContain('Backward')
    expect(html).not.toContain('🔒')
    expect(html).not.toContain('🔓')
    expect(html).not.toContain('↑ Forward')
    expect(html).not.toContain('↓ Backward')
  })

  it('wires the game-specific Delete button to the selected element callback', () => {
    const onDeleteElement = vi.fn()
    const gameElement = {
      id: 'game-1',
      type: 'game',
      gameType: 'name-picker',
      items: ['Ada'],
      x: 10,
      y: 20,
      width: 640,
      height: 480,
      rotation: 0,
    }
    render(
      <PropertiesPanel
        slide={{ ...baseSlide, elements: [gameElement] }}
        selectedElement={gameElement}
        selectedElementIds={[gameElement.id]}
        onUpdateElement={() => {}}
        onDeleteElement={onDeleteElement}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete game' }))

    expect(onDeleteElement).toHaveBeenCalledTimes(1)
  })

  it('clamps negative auto-slide values to zero before persisting', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <PropertiesPanel
        slide={baseSlide}
        presentation={{ autoSlide: 0 }}
        onUpdateSlide={vi.fn()}
        onUpdatePresentation={onUpdatePresentation}
      />
    )

    fireEvent.change(screen.getByLabelText('Auto-slide (s)'), { target: { value: '-3' } })

    expect(onUpdatePresentation).toHaveBeenCalledWith({ autoSlide: 0 })
  })

  it('reindexes footer sections across the whole presentation', () => {
    const onUpdatePresentation = vi.fn()
    const presentation = {
      showFooter: true,
      footerMode: 'sequence',
      sequenceSections: ['One', 'Two', 'Three'],
      slides: [
        { id: 'slide-1', elements: [], activeSection: 2 },
        { id: 'slide-2', elements: [], activeSection: 0 },
        { id: 'slide-3', elements: [], activeSection: 1 },
        {
          id: 'slide-4',
          elements: [],
          activeSection: null,
          children: [{ id: 'slide-4-child', elements: [], activeSection: 2 }],
        },
      ],
    }
    render(
      <PropertiesPanel
        slide={presentation.slides[0]}
        presentation={presentation}
        onUpdateSlide={vi.fn()}
        onUpdatePresentation={onUpdatePresentation}
      />
    )

    fireEvent.click(screen.getAllByTitle('Remove section')[0])

    const updatePresentation = onUpdatePresentation.mock.calls[0][0]
    expect(typeof updatePresentation).toBe('function')
    const next = updatePresentation(presentation)
    expect(next.sequenceSections).toEqual(['Two', 'Three'])
    expect(next.slides.map((slide) => slide.activeSection)).toEqual([1, null, 0, null])
    expect(next.slides[3].children[0].activeSection).toBe(1)
  })

  it('names dense footer and template controls without trapping reverse Tab', () => {
    const { container } = render(
      <PropertiesPanel
        slide={{ ...baseSlide, activeSection: 0 }}
        isTemplate={true}
        presentation={{
          showFooter: true,
          showPageNumbers: true,
          footerMode: 'sequence',
          sequenceSections: ['Opening', 'Closing'],
          customCSS: '',
        }}
        onUpdateSlide={vi.fn()}
        onUpdatePresentation={vi.fn()}
      />
    )

    const controls = [...container.querySelectorAll('button, input, select, textarea')]
    expect(controls.filter((control) => !computeAccessibleName(control).trim())).toEqual([])
    expect(screen.getByRole('button', { name: 'Use footer section 1: Opening' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Sequence footer mode' }).getAttribute('aria-pressed')).toBe('true')
    expect(
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Template custom CSS' }), {
        key: 'Tab',
        shiftKey: true,
      })
    ).toBe(true)
  })

  it('edits and clears the shared element action metadata', () => {
    const onUpdateElement = vi.fn()
    render(<PropertiesPanel slide={{ ...baseSlide, elements: [shapeElement] }} selectedElement={shapeElement} onUpdateElement={onUpdateElement} onUpdateSlide={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Element action'), { target: { value: 'next' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ action: { kind: 'next' } })
    fireEvent.change(screen.getByLabelText('Element action'), { target: { value: 'none' } })
    expect(onUpdateElement).toHaveBeenLastCalledWith({ action: null })
  })
})
