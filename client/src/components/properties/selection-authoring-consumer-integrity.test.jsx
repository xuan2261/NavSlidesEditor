import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderElement } from '../../../../shared/src/element-renderers.js'
import { normalizeSlideConnectorConnections } from '../../../../shared/src/connector-geometry.js'
import { buildSelectionUpdates, buildConnectorUpdateBatch } from '../../utils/element-update-fanout'
import ShapeProperties from './shape-properties'
import CommonElementControls from './common-element-controls'
import MediaProperties from './media-properties'
import FormatTabContent from '../ribbon/ribbon-format-tab-element-position-size-rotation-controls'

const geometry = { x: 40, y: 50, width: 300, height: 100 }
const shape = (id, extra = {}) => ({
  ...geometry,
  id,
  type: 'shape',
  shape: 'rect',
  text: id,
  ...extra,
})

function Authoring({ initial, ids = initial.map((el) => el.id), primary = ids.at(-1), Controls }) {
  const [elements, setElements] = useState(initial)
  const element = elements.find((el) => el.id === primary)
  const apply = (updates) =>
    setElements((previous) =>
      previous.map((el) => ({ ...el, ...updates.find((patch) => patch.id === el.id) }))
    )
  const onUpdate = (changes) =>
    apply(
      buildConnectorUpdateBatch(elements, buildSelectionUpdates(elements, ids, primary, changes))
    )
  const props = { element, onUpdate, elements, selectedElementIds: ids }
  return (
    <>
      {Controls === FormatTabContent ? (
        <FormatTabContent
          selectedElement={element}
          onUpdateElement={onUpdate}
          elements={elements}
          selectedElementIds={ids}
        />
      ) : (
        <Controls {...props} />
      )}
      <button
        onClick={() => apply(buildConnectorUpdateBatch(elements, [{ id: 'target', x: 200 }]))}
      >
        Move target
      </button>
      <button onClick={() => setElements(normalizeSlideConnectorConnections(elements))}>
        Reload elements
      </button>
      <output data-testid="saved-integrity">{JSON.stringify(elements)}</output>
      <div
        data-testid="generated-integrity"
        dangerouslySetInnerHTML={{ __html: elements.map((el) => renderElement(el, {})).join('') }}
      />
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('saved-integrity').textContent)

describe('selection authoring consumer integrity', () => {
  it('detaches a final endpoint through reload without moving its negative local coordinates', () => {
    const line = {
      id: 'line',
      type: 'line',
      x: 600,
      y: 250,
      width: 180,
      height: 1,
      x1: 70,
      y1: -105,
      x2: 180,
      y2: 0,
      connections: { start: { targetId: 'target', anchor: 'center' } },
    }
    render(
      <Authoring
        Controls={ShapeProperties}
        initial={[shape('target', { x: 580, y: 100, width: 180, height: 90 }), line]}
        ids={['line']}
      />
    )
    fireEvent.change(screen.getByLabelText('Start connector target'), { target: { value: '' } })
    expect(saved()[1].connections).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: 'Reload elements' }))
    const expectedFree = { ...line }
    delete expectedFree.connections
    expect(saved()[1]).not.toHaveProperty('connections')
    expect(saved()[1]).toEqual(expectedFree)
    const free = saved()[1]
    fireEvent.click(screen.getByRole('button', { name: 'Move target' }))
    expect(saved()[1]).toEqual(free)
    expect(saved()[0].x).toBe(200)
  })

  it('retains the other attachment when freeing one endpoint', () => {
    const end = { targetId: 'other', anchor: 'n' }
    const line = {
      ...geometry,
      id: 'line',
      type: 'line',
      endX: 100,
      endY: 50,
      connections: { start: { targetId: 'target', anchor: 'center' }, end },
    }
    render(
      <Authoring
        Controls={ShapeProperties}
        initial={[shape('target'), shape('other'), line]}
        ids={['line']}
      />
    )
    fireEvent.change(screen.getByLabelText('Start connector target'), { target: { value: '' } })
    expect(saved()[2].connections).toEqual({ end })
  })

  for (const primary of ['plain', 'rich']) {
    it(`does not offer mirror-only label writes with a ${primary} primary`, () => {
      const initial = [
        shape('plain'),
        shape('rich', { text: 'Rich', textHtml: '<p><strong>Rich</strong></p>' }),
      ]
      render(<Authoring Controls={ShapeProperties} initial={initial} primary={primary} />)
      if (primary === 'plain') expect(screen.getByLabelText('Shape label text').disabled).toBe(true)
      else
        expect(
          screen.getByRole('textbox', { name: 'Shape rich label' }).getAttribute('aria-readonly')
        ).toBe('true')
      expect(saved()).toEqual(initial)
      const output = screen.getByTestId('generated-integrity')
      expect(output.textContent).toContain('plain')
      expect(output.querySelector('strong').textContent).toBe('Rich')
    })
  }

  for (const Controls of [CommonElementControls, FormatTabContent]) {
    for (const primary of ['free', 'locked']) {
      it(`shows mixed locks and applies explicit intent through ${Controls.name} with ${primary} primary`, () => {
        render(
          <Authoring
            Controls={Controls}
            initial={[shape('free'), shape('locked', { locked: true })]}
            primary={primary}
          />
        )
        const control =
          Controls === CommonElementControls
            ? screen.getByRole('checkbox', { name: 'Lock element' })
            : screen.getByRole('button', { name: 'Toggle lock' })
        expect(
          control.getAttribute(Controls === CommonElementControls ? 'aria-checked' : 'aria-pressed')
        ).toBe('mixed')
        if (Controls === CommonElementControls) expect(control.indeterminate).toBe(true)
        fireEvent.click(control)
        if (Controls === FormatTabContent) fireEvent.keyDown(control, { key: 'Enter' })
        expect(saved().map((el) => Boolean(el.locked))).toEqual(
          primary === 'locked' ? [false, false] : [true, true]
        )
      })
    }
  }

  for (const Controls of [MediaProperties, FormatTabContent]) {
    it(`shows an owner-aware mixed source and preserves non-owners through ${Controls.name}`, () => {
      const nonOwner = shape('non-owner')
      const locked = {
        ...geometry,
        id: 'locked-media',
        type: 'audio',
        src: '/old.wav',
        locked: true,
      }
      render(
        <Authoring
          Controls={Controls}
          initial={[
            { ...geometry, id: 'a', type: 'audio', src: '/a.wav' },
            { ...geometry, id: 'b', type: 'video', src: '/b.webm' },
            nonOwner,
            locked,
          ]}
          primary="a"
        />
      )
      const input = screen.getByRole('textbox', {
        name: Controls === MediaProperties ? 'Audio source URL' : 'Source URL',
      })
      expect(input.value).toBe('')
      expect(input.getAttribute('data-mixed')).toBe('true')
      fireEvent.change(input, { target: { value: '/next.wav' } })
      expect(
        saved()
          .slice(0, 2)
          .map((el) => el.src)
      ).toEqual(['/next.wav', '/next.wav'])
      expect(saved()[2]).toEqual(nonOwner)
      expect(saved()[3]).toEqual(locked)
    })
  }

  it('retains numeric and string zero cells in generated consumer output', () => {
    const table = {
      ...geometry,
      id: 'table',
      type: 'table',
      headerRow: false,
      data: [[0, '0', '', null, false]],
    }
    const node = document.createElement('div')
    node.innerHTML = renderElement(table, {}, {})
    expect([...node.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
      '0',
      '0',
      '',
      '',
      'false',
    ])
  })
})
