import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AnimeModal from './anime-js-animation-template-selector-modal.jsx'
import KineticTextModal from './kinetic-text-animation-template-selector-modal.jsx'
import MathGridModal from './parametric-math-grid-surface-plotter-modal.jsx'
import ThreeModal from './three-js-3d-scene-template-selector-modal.jsx'
import FileBrowserModal from './file-browser-modal-to-select-and-insert-media.jsx'

const cases = [
  ['Anime.js Animation', AnimeModal, {}],
  ['Kinetic Text', KineticTextModal, {}],
  ['Math Grid', MathGridModal, {}],
  ['Three.js 3D Scene', ThreeModal, {}],
  ['File Browser', FileBrowserModal, { presentationId: '' }],
]

describe.each(cases)('%s modal accessibility', (title, Component, extraProps) => {
  it('uses the shared modal semantics and closes on Escape', () => {
    const onClose = vi.fn()
    render(<Component {...extraProps} onInsert={vi.fn()} onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: title })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Close ${title}` })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
