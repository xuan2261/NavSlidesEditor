import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultGameConfig } from 'revealjs-shared'
import { mount } from 'revealjs-shared/src/education/browser/mount.js'
import NativeGameTryAdapter from './native-game-try-adapter.jsx'

let hidden, hiddenDescriptor
const element = {
  id: 'native-picker',
  type: 'game',
  gameType: 'name-picker',
  'name-picker': {
    ...createDefaultGameConfig('name-picker'),
    pickerMode: 'button',
    animationDuration: 1000,
    items: [
      { id: 'an', label: 'An', weight: 1 },
      { id: 'binh', label: 'Bình', weight: 1 },
    ],
  },
}
const advance = (ms) => act(() => vi.advanceTimersByTime(ms))
function visibility(value) {
  hidden = value
  act(() => document.dispatchEvent(new Event('visibilitychange')))
}
function openTry() {
  const view = render(<NativeGameTryAdapter element={element} effectiveSlideId="lesson" />)
  const root = view.container.querySelector('[data-ns-game]')
  return { ...view, root, api: mount(root) }
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  hidden = false
  hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})
afterEach(() => {
  cleanup()
  if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor)
  else delete document.hidden
  vi.useRealTimers()
})

describe('native Try local document lifetime', () => {
  it('holds a pending pick while hidden and resumes only its remaining active delay', () => {
    const { api, root } = openTry()
    fireEvent.click(screen.getByRole('button', { name: 'Pick', exact: true }))
    advance(150)
    visibility(true)
    advance(2000)
    expect(api.getState()).toMatchObject({ phase: 'picking', picks: 0 })
    visibility(false)
    advance(849)
    expect(api.getState()).toMatchObject({ phase: 'picking', picks: 0 })
    advance(1)
    expect(api.getState()).toMatchObject({ phase: 'result', picks: 1, pending: null })
    expect(root.querySelector('[data-ns-winner]').textContent).toBe(api.getState().lastWinner.label)
    advance(2000)
    expect(api.getState().picks).toBe(1)
  })
  it('reconciles an initially hidden mount and closing prevents old work from leaking into a reopened Try', () => {
    hidden = true
    const first = openTry()
    fireEvent.click(screen.getByRole('button', { name: 'Pick', exact: true }))
    advance(2000)
    expect(first.api.getState()).toMatchObject({ phase: 'picking', picks: 0 })
    first.unmount()
    visibility(false)
    const second = openTry()
    fireEvent.click(screen.getByRole('button', { name: 'Pick', exact: true }))
    advance(1000)
    expect(second.api.getState()).toMatchObject({ phase: 'result', picks: 1, pending: null })
    expect(first.api.getState().picks).toBe(0)
  })
})
