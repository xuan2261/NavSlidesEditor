import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorElementController } from './use-editor-element-controller'

describe('active slide metadata lock policy', () => {
  it.each(['parent', 'child'])('protects locked %s slide metadata until explicitly unlocked', (target) => {
    const background = { type: 'color', color: '#123456' }
    const lockedSlide = { id: target, locked: true, background, transition: 'fade', elements: [] }
    let deck = { slides: [target === 'parent' ? lockedSlide : {
      id: 'parent', background: { type: 'color', color: '#abcdef' }, children: [lockedSlide],
    }] }
    const activeSlide = () => target === 'parent' ? deck.slides[0] : deck.slides[0].children[0]
    const controller = {
      editingElementIdRef: { current: null },
      setPresentation: (update) => { deck = update(deck) },
      mapActive: (prev, update) => ({ ...prev, slides: [target === 'parent'
        ? update(prev.slides[0])
        : { ...prev.slides[0], children: [update(prev.slides[0].children[0])] }] }),
    }
    const { result } = renderHook(() => useEditorElementController(controller))
    act(() => result.current.updateCurrentSlide({ background: { type: 'color', color: '#ff0000' } }))
    act(() => result.current.updateCurrentSlide({ transition: 'slide', transitionDuration: 2 }))
    act(() => result.current.updateCurrentSlide({ locked: false, transition: 'zoom' }))
    expect(activeSlide()).toBe(lockedSlide)
    act(() => result.current.updateCurrentSlide({ locked: false }))
    act(() => result.current.updateCurrentSlide({ transition: 'slide', transitionDuration: 2 }))
    expect(activeSlide()).toMatchObject({ locked: false, background, transition: 'slide', transitionDuration: 2 })
    if (target === 'child') expect(deck.slides[0].background.color).toBe('#abcdef')
  })
})
