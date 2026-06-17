import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TimelineProperties from './timeline-properties'

describe('timeline properties controls', () => {
  it('[cap:element.timeline tier:deep depth:behavior] writes connector length to events and legacy items', () => {
    const onUpdate = vi.fn()
    render(
      <TimelineProperties
        element={{
          id: 'timeline-1',
          type: 'timeline',
          timelineStart: '2000',
          timelineEnd: '2025',
          events: [{ id: 'event-1', date: '2010', title: 'Launch', connectorOffset: 10 }],
        }}
        onUpdate={onUpdate}
      />
    )

    fireEvent.change(screen.getByTestId('prop-timeline-connector-0'), { target: { value: '64' } })

    expect(onUpdate).toHaveBeenCalledWith({
      events: [expect.objectContaining({ id: 'event-1', connectorOffset: 64 })],
      items: [expect.objectContaining({ id: 'event-1', connectorLength: 64 })],
    })
  })
})
