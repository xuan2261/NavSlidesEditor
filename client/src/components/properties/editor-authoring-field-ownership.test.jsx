import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { renderElement } from '../../../../shared/src/element-renderers.js'
import ActionControls from './action-controls'
import MediaProperties from './media-properties'
import TimelineProperties from './timeline-properties'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'

function Authoring({ initial, Controls }) {
  const [elements, setElements] = useState(initial)
  const selected = elements[0]
  const update = (changes) => {
    const patches = buildSelectionUpdates(
      elements,
      elements.map(({ id }) => id),
      selected.id,
      changes
    )
    setElements((previous) =>
      previous.map((element) => ({
        ...element,
        ...patches.find(({ id }) => id === element.id),
      }))
    )
  }
  return (
    <>
      <Controls element={selected} onUpdate={update} />
      <output data-testid="saved-elements">{JSON.stringify(elements)}</output>
      <div
        data-testid="exported-consumer"
        dangerouslySetInnerHTML={{
          __html: elements.map((element) => renderElement(element, {})).join(''),
        }}
      />
    </>
  )
}

const saved = () => JSON.parse(screen.getByTestId('saved-elements').textContent)
const geometry = { x: 40, y: 50, width: 400, height: 100 }

describe('existing authoring field ownership', () => {
  it('edits and clears universal actions without mutating locked elements', () => {
    const locked = { ...geometry, id: 'locked', type: 'text', content: 'Locked', locked: true }
    render(
      <Authoring
        Controls={ActionControls}
        initial={[
          { ...geometry, id: 'shape', type: 'shape', shape: 'rect', text: 'Action shape' },
          { ...geometry, id: 'code', type: 'code', content: 'const value = 1' },
          locked,
        ]}
      />
    )
    fireEvent.change(screen.getByLabelText('Element action'), { target: { value: 'next' } })
    fireEvent.change(screen.getByLabelText('Action label'), { target: { value: 'Advance slide' } })
    expect(
      saved()
        .slice(0, 2)
        .map(({ action }) => action)
    ).toEqual([
      { kind: 'next', label: 'Advance slide' },
      { kind: 'next', label: 'Advance slide' },
    ])
    expect(saved()[2]).toEqual(locked)
    expect(
      within(screen.getByTestId('exported-consumer')).getAllByRole('button', {
        name: 'Advance slide',
      })
    ).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Clear action' }))
    expect(
      saved()
        .slice(0, 2)
        .map(({ action }) => action)
    ).toEqual([null, null])
    expect(
      within(screen.getByTestId('exported-consumer')).queryByRole('button', {
        name: 'Advance slide',
      })
    ).toBeNull()
  })

  it('persists legacy media descriptions only for unlocked media owners', () => {
    const text = { ...geometry, id: 'text', type: 'text', content: '<p>Non-media</p>' }
    const locked = { ...geometry, id: 'locked', type: 'video', src: '/locked.mp4', locked: true }
    render(
      <Authoring
        Controls={MediaProperties}
        initial={[
          { ...geometry, id: 'audio', type: 'audio', src: '/audio.wav' },
          { ...geometry, id: 'video', type: 'video', src: '/video.mp4' },
          text,
          locked,
        ]}
      />
    )
    fireEvent.change(screen.getByLabelText('Media transcript'), {
      target: { value: 'Spoken explanation' },
    })
    fireEvent.change(screen.getByLabelText('Media audio description'), {
      target: { value: 'A blue diagram appears' },
    })
    const after = saved()
    expect(after[0].transcript).toBe('Spoken explanation')
    expect(after[1].audioDescription).toBe('A blue diagram appears')
    expect(after[2]).toEqual(text)
    expect(after[3]).toEqual(locked)
    const exported = screen.getByTestId('exported-consumer')
    expect(exported.querySelectorAll('details p')).toHaveLength(2)
    expect(exported.querySelector('details p').textContent).toBe('Spoken explanation')
    expect(exported.querySelectorAll('.ns-media-audio-description')).toHaveLength(2)
    expect(exported.querySelector('.ns-media-audio-description').textContent).toBe(
      'A blue diagram appears'
    )
  })

  it('moves legacy event connectors according to the authored length', () => {
    render(
      <Authoring
        Controls={TimelineProperties}
        initial={[
          {
            ...geometry,
            height: 200,
            id: 'timeline',
            type: 'timeline',
            startDate: '2000',
            endDate: '2025',
            items: [{ id: 'event', date: '2012', label: 'Legacy event', connectorLength: 12 }],
          },
        ]}
      />
    )
    fireEvent.change(screen.getByLabelText('Timeline event 1 connector length'), {
      target: { value: '64' },
    })
    const connector = screen
      .getByTestId('exported-consumer')
      .querySelector('line[stroke-dasharray]')
    expect(connector.getAttribute('y1')).toBe('8')
    expect(connector.getAttribute('y2')).toBe('100')
    expect(saved()[0].events[0].connectorLength).toBe(64)
  })

  it('keeps authoritative zero connector length when only a legacy event title changes', () => {
    render(
      <Authoring
        Controls={TimelineProperties}
        initial={[
          {
            ...geometry,
            height: 200,
            id: 'timeline',
            type: 'timeline',
            startDate: '2000',
            endDate: '2025',
            events: [
              {
                id: 'event',
                date: '2012',
                title: 'Legacy event',
                connectorLength: 0,
                connectorOffset: 110,
              },
            ],
          },
        ]}
      />
    )
    fireEvent.change(screen.getByLabelText('Timeline event 1 title'), {
      target: { value: 'Renamed event' },
    })
    expect(saved()[0].events[0].connectorLength).toBe(0)
    expect(saved()[0].events[0].title).toBe('Renamed event')
    const connector = screen
      .getByTestId('exported-consumer')
      .querySelector('line[stroke-dasharray]')
    expect(connector.getAttribute('y1')).toBe('72')
    expect(connector.getAttribute('y2')).toBe('100')
  })
})
