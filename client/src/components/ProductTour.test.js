import React from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProductTour from './ProductTour.jsx'

const joyrideMock = vi.hoisted(() => vi.fn())
const joyrideStatus = vi.hoisted(() => ({
  FINISHED: 'finished',
  SKIPPED: 'skipped',
}))
const joyrideActions = vi.hoisted(() => ({
  NEXT: 'next',
  PREV: 'prev',
  CLOSE: 'close',
}))
const joyrideEvents = vi.hoisted(() => ({
  STEP_AFTER: 'step:after',
}))

vi.mock('react-joyride', () => ({
  Joyride: (props) => {
    joyrideMock(props)
    return null
  },
  ACTIONS: joyrideActions,
  EVENTS: joyrideEvents,
  STATUS: joyrideStatus,
}))

describe('ProductTour', () => {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
  }

  beforeEach(() => {
    joyrideMock.mockReset()
    localStorageMock.getItem.mockReset()
    localStorageMock.setItem.mockReset()
    vi.stubGlobal('localStorage', localStorageMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses a continuous guided tour with explicit placements', () => {
    localStorageMock.getItem.mockReturnValue(null)

    renderToString(React.createElement(ProductTour))

    expect(joyrideMock).toHaveBeenCalledTimes(1)
    const props = joyrideMock.mock.calls[0][0]

    expect(props.run).toBe(false)
    expect(props.continuous).toBe(true)
    expect(props.stepIndex).toBe(0)
    expect(typeof props.onEvent).toBe('function')
    expect(props.options).toMatchObject({
      showProgress: true,
      overlayClickAction: false,
      dismissKeyAction: false,
      blockTargetInteraction: true,
    })

    expect(props.steps).toHaveLength(6)
    expect(props.steps.every((step) => step.skipBeacon === true)).toBe(true)
    expect(props.steps[0].placement).toBe('center')
    expect(props.steps[1].placement).toBe('bottom-end')
    expect(props.steps[2].placement).toBe('right')
    expect(props.steps[3].placement).toBe('bottom-start')
    expect(props.steps[4].placement).toBe('center')
    expect(props.steps[5].placement).toBe('left')
  })

  it('does not rerun once the tutorial has been seen', () => {
    localStorageMock.getItem.mockReturnValue('true')

    renderToString(React.createElement(ProductTour))

    expect(joyrideMock).toHaveBeenCalledTimes(1)
    expect(joyrideMock.mock.calls[0][0].run).toBe(false)
  })
})
