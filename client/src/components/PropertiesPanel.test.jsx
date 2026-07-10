import React from 'react'
import { renderToString } from 'react-dom/server'
import { fireEvent, render, screen } from '@testing-library/react'
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
})
