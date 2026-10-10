import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShapeProperties from './shape-properties'
import CodeProperties from './code-properties'
import MiscProperties from './misc-properties'
import TableProperties from './table-properties'
import TimelineProperties from './timeline-properties'

function Editor({ component: Component, type }) {
  const [element, setElement] = useState({
    id: 'font-element',
    type,
    fontSize: 16,
    shape: 'rect',
    text: 'Label',
    data: [['A', 'B']],
    marker: 'Retained',
  })
  return (
    <>
      <Component
        element={element}
        onUpdate={(patch) => setElement((current) => ({ ...current, ...patch }))}
      />
      <output data-testid="font-state">{JSON.stringify(element)}</output>
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('font-state').textContent)
const cases = [
  ['shape', ShapeProperties, 'Shape label text size', '28', 144],
  ['code', CodeProperties, 'Code font size', '22', 32],
  ['latex', MiscProperties, 'LaTeX font size', '24', 96],
  ['markdown', MiscProperties, 'Markdown font size', '24', 120],
  ['table', TableProperties, 'Table font size', '20', 32],
  ['callout', MiscProperties, 'Callout Font Size', '36', 48],
  ['timeline', TimelineProperties, 'Timeline font size', '16', 24],
]

describe('incremental font authoring', () => {
  it.each(cases)(
    'retains %s numeric draft while preserving canonical bounds',
    async (type, Component, label, value, max) => {
      const user = userEvent.setup()
      render(<Editor component={Component} type={type} />)
      const field = screen.getByLabelText(label)
      await user.clear(field)
      await user.type(field, value[0])
      expect(field.value).toBe(value[0])
      expect(saved().fontSize).toBe(8)
      await user.type(field, value.slice(1))
      expect(field.value).toBe(value)
      expect(saved().fontSize).toBe(Number(value))
      expect(saved().marker).toBe('Retained')
      await user.tab()
      expect(field.value).toBe(value)
      await user.clear(field)
      await user.type(field, '999')
      expect(saved().fontSize).toBe(max)
      await user.tab()
      expect(field.value).toBe(String(max))
      await user.clear(field)
      expect(field.value).toBe('')
      expect(saved().fontSize).toBe(type === 'timeline' ? 11 : max)
      await user.tab()
      expect(field.value).toBe(String(type === 'timeline' ? 11 : max))
    }
  )
})
