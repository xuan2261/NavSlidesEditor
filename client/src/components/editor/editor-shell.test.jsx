import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import EditorShell from './editor-shell'

describe('EditorShell', () => {
  it('preserves the editor slot order and child identity across rerenders', () => {
    const canvas = <div data-testid="canvas">Canvas</div>
    const { rerender } = render(
      <EditorShell
        smallScreenGuard={<div data-testid="guard" />}
        header={<header data-testid="header" />}
        leftPanel={<aside data-testid="left" />}
        ribbon={<nav data-testid="ribbon" />}
        canvas={canvas}
        rightPanels={<aside data-testid="right" />}
        overlays={<div data-testid="overlays" />}
        tour={<div data-testid="tour" />}
      />
    )
    const originalCanvas = screen.getByTestId('canvas')
    const order = [...screen.getByTestId('header').parentElement.children]

    rerender(
      <EditorShell
        smallScreenGuard={<div data-testid="guard" />}
        header={<header data-testid="header" />}
        leftPanel={<aside data-testid="left" />}
        ribbon={<nav data-testid="ribbon" />}
        canvas={canvas}
        rightPanels={<aside data-testid="right" />}
        overlays={<div data-testid="overlays" />}
        tour={<div data-testid="tour" />}
      />
    )

    expect(screen.getByTestId('canvas')).toBe(originalCanvas)
    expect(order.map((node) => node.dataset.testid)).toEqual([
      'header', undefined, 'overlays', 'tour',
    ])
  })
})
