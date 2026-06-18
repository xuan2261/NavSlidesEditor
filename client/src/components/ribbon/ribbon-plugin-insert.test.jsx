import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import InsertTabContent from './ribbon-insert-tab-element-galleries-panel.jsx'
import { GAME_TYPES } from '../../constants/game-element-types-constants.js'

describe('InsertTabContent plugin section', () => {
  it('does not show plugin actions when no plugin types are loaded', () => {
    render(<InsertTabContent pluginTypes={[]} />)

    expect(screen.queryByText('Animated Counter')).toBeNull()
  })

  it('shows plugin action and activates it from keyboard', () => {
    const onAddPluginElement = vi.fn()
    render(
      <InsertTabContent
        pluginTypes={[{ fullType: 'plugin:counter', label: 'Animated Counter' }]}
        onAddPluginElement={onAddPluginElement}
      />
    )

    fireEvent.mouseDown(screen.getByLabelText('More advanced insert options'))
    const action = screen.getByText('Animated Counter')
    fireEvent.keyDown(action, { key: 'Enter' })

    expect(onAddPluginElement).toHaveBeenCalledWith('plugin:counter')
  })

  it('keeps the launcher visible for games when no plugin types are loaded', () => {
    render(<InsertTabContent pluginTypes={[]} />)

    fireEvent.mouseDown(screen.getByLabelText('More advanced insert options'))

    expect(screen.getByRole('menuitem', { name: 'Games...' })).toBeTruthy()
    expect(screen.queryByText('Animated Counter')).toBeNull()
  })

  it('[cap:element.html depth:behavior] exposes Mermaid insert as an html embed preset', () => {
    const onAddMermaid = vi.fn()
    render(<InsertTabContent pluginTypes={[]} onAddMermaid={onAddMermaid} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add Mermaid diagram' }))

    expect(onAddMermaid).toHaveBeenCalledTimes(1)
  })

  it('[cap:element.html depth:behavior] opens STEM preset modal and inserts validated embed', () => {
    const onAddStemSimulation = vi.fn()
    render(<InsertTabContent pluginTypes={[]} onAddStemSimulation={onAddStemSimulation} />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Add STEM simulation' }))
    fireEvent.change(screen.getByLabelText(/Provider/i), { target: { value: 'geogebra' } })
    fireEvent.change(screen.getByLabelText(/URL or ID/i), { target: { value: 'abc123' } })
    fireEvent.click(screen.getByText('Insert'))

    expect(onAddStemSimulation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'html',
        embedKind: 'stem-simulation',
        provider: 'geogebra',
        sourceUrl: 'https://www.geogebra.org/material/iframe/id/abc123',
      })
    )
  })

  it('[cap:element.game depth:behavior] exposes every game subtype and maps each to onAddGame', () => {
    const onAddGame = vi.fn()
    render(<InsertTabContent pluginTypes={[]} onAddGame={onAddGame} />)

    GAME_TYPES.all.forEach((gameType) => {
      fireEvent.mouseDown(screen.getByLabelText('More advanced insert options'))
      fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Games...' }))

      const option = screen.getByText(
        {
          'name-picker': 'Name Picker',
          'hot-potato': 'Hot Potato',
          jeopardy: 'Jeopardy',
          'four-corners': 'Four Corners',
          'relay-race': 'Relay Race',
          'trivia-champ': 'Trivia',
          scattergories: 'Scattergories',
          poll: 'Live Poll',
          'word-cloud': 'Word Cloud',
          matching: 'Matching',
        }[gameType]
      )
      fireEvent.mouseDown(option)
    })

    expect(onAddGame).toHaveBeenCalledTimes(GAME_TYPES.all.length)
    expect(onAddGame.mock.calls.map(([gameType]) => gameType)).toEqual(GAME_TYPES.all)
  })
})
