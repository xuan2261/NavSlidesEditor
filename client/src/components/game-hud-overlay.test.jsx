import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GameHudOverlay } from './game-hud-overlay'

describe('GameHudOverlay', () => {
  it('renders HUD for kebab-case gameType', () => {
    const { container } = render(
      <GameHudOverlay visible={true} gameType="jeopardy" onClose={vi.fn()} />
    )
    expect(container.querySelector('.game-hud-overlay')).not.toBeNull()
  })

  it('renders HUD for camelCase gameType (normalizes to kebab)', () => {
    const { container } = render(
      <GameHudOverlay visible={true} gameType="hotPotato" onClose={vi.fn()} />
    )
    // Should normalize 'hotPotato' → 'hot-potato' and find config
    expect(container.querySelector('.game-hud-overlay')).not.toBeNull()
  })

  it('renders HUD for PascalCase gameType', () => {
    const { container } = render(
      <GameHudOverlay visible={true} gameType="NamePicker" onClose={vi.fn()} />
    )
    expect(container.querySelector('.game-hud-overlay')).not.toBeNull()
  })

  it('renders nothing for unknown gameType', () => {
    const { container } = render(
      <GameHudOverlay visible={true} gameType="unknown-game" onClose={vi.fn()} />
    )
    expect(container.querySelector('.game-hud-overlay')).toBeNull()
  })

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <GameHudOverlay visible={false} gameType="jeopardy" onClose={vi.fn()} />
    )
    expect(container.querySelector('.game-hud-overlay')).toBeNull()
  })

  it('renders nothing when gameType is missing', () => {
    const { container } = render(
      <GameHudOverlay visible={true} gameType="" onClose={vi.fn()} />
    )
    expect(container.querySelector('.game-hud-overlay')).toBeNull()
  })
})
