import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import FormatTabContent from './ribbon-format-tab-element-position-size-rotation-controls'

const mockElement = {
  id: 'el-1',
  type: 'text',
  x: 100,
  y: 200,
  width: 300,
  height: 150,
  rotation: 0,
  locked: false,
}

describe('FormatTabContent', () => {
  it('shows placeholder when no element selected', () => {
    render(<FormatTabContent />)
    expect(screen.getByText('Select an element to format')).toBeTruthy()
  })

  it('renders no-selection state inside the classic row and Selection section', () => {
    const { container } = render(<FormatTabContent />)
    const row = container.querySelector('[data-ribbon-content-row]')
    const section = container.querySelector('[data-ribbon-section]')
    const label = container.querySelector('[data-ribbon-section-label]')

    expect(row).toBeTruthy()
    expect(section).toBeTruthy()
    expect(label?.textContent).toBe('Selection')
    expect(section?.textContent).toContain('Select an element to format')
  })

  it('renders all five sections when element selected', () => {
    const { container } = render(<FormatTabContent selectedElement={mockElement} />)
    const labels = container.querySelectorAll('[data-ribbon-section-label]')
    const labelTexts = [...labels].map((el) => el.textContent)
    expect(labelTexts).toContain('Position')
    expect(labelTexts).toContain('Size')
    expect(labelTexts).toContain('Rotate')
    expect(labelTexts).toContain('Align')
    expect(labelTexts).toContain('Properties')
  })

  it('displays current position values', () => {
    render(<FormatTabContent selectedElement={mockElement} />)
    expect(screen.getByLabelText('X position').value).toBe('100')
    expect(screen.getByLabelText('Y position').value).toBe('200')
  })

  it('displays current size values', () => {
    render(<FormatTabContent selectedElement={mockElement} />)
    expect(screen.getByLabelText('Width').value).toBe('300')
    expect(screen.getByLabelText('Height').value).toBe('150')
  })

  it('[cap:control.format.position depth:behavior] calls onUpdateElement for position change', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)
    fireEvent.change(screen.getByLabelText('X position'), { target: { value: '50' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ x: 50 })
  })

  it('calls onUpdateElement for size change', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '400' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ width: 400 })
  })

  it('calls onUpdateElement for rotation change', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)
    fireEvent.change(screen.getByLabelText('Rotation degrees'), { target: { value: '45' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ rotation: 45 })
  })

  it('rotates each selected element relative to its own angle and leaves unselected elements unchanged', () => {
    function Selection() {
      const [elements, setElements] = useState([
        { ...mockElement, id: 'a', rotation: 0 },
        { ...mockElement, id: 'b', rotation: 315 },
        { ...mockElement, id: 'c', rotation: 45 },
      ])
      return (
        <>
          <FormatTabContent
            selectedElement={elements[1]}
            selectedElementIds={['a', 'b']}
            elements={elements}
            onUpdateElements={(updates) =>
              setElements((previous) =>
                previous.map((element) => ({
                  ...element,
                  ...updates.find((update) => update.id === element.id),
                }))
              )
            }
          />
          <output data-testid="rotations">
            {elements.map((element) => `${element.id}:${element.rotation}`).join(',')}
          </output>
        </>
      )
    }
    render(<Selection />)
    fireEvent.mouseDown(screen.getByLabelText('Rotate 90 degrees'))
    expect(screen.getByTestId('rotations').textContent).toBe('a:90,b:45,c:45')
    fireEvent.keyDown(screen.getByLabelText('Rotate 90 degrees'), { key: 'Enter' })
    expect(screen.getByTestId('rotations').textContent).toBe('a:180,b:135,c:45')
  })

  it('activates the lock control with keyboard', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)

    fireEvent.keyDown(screen.getByLabelText('Toggle lock'), { key: ' ' })

    expect(onUpdateElement).toHaveBeenCalledWith({ locked: true })
  })

  it('calls onUpdateElement for lock toggle', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)
    fireEvent.mouseDown(screen.getByLabelText('Toggle lock'))
    expect(onUpdateElement).toHaveBeenCalledWith({ locked: true })
  })

  it('shows Locked text when element is locked', () => {
    render(<FormatTabContent selectedElement={{ ...mockElement, locked: true }} />)
    expect(screen.getByText('Locked')).toBeTruthy()
  })

  it('resizes table rows and columns by updating data, not inert rows/cols fields', () => {
    const onUpdateElement = vi.fn()
    render(
      <FormatTabContent
        selectedElement={{
          ...mockElement,
          type: 'table',
          data: [
            ['H1', 'H2'],
            ['A1', 'A2'],
          ],
          cellStyles: {
            textColors: [
              ['#fff', null],
              [null, null],
            ],
          },
        }}
        onUpdateElement={onUpdateElement}
      />
    )

    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '3' } })
    expect(onUpdateElement).toHaveBeenLastCalledWith({
      data: [
        ['H1', 'H2'],
        ['A1', 'A2'],
        ['', ''],
      ],
      cellStyles: {
        textColors: [
          ['#fff', null],
          [null, null],
          [null, null],
        ],
        bgColors: [
          [null, null],
          [null, null],
          [null, null],
        ],
        isBold: [
          [null, null],
          [null, null],
          [null, null],
        ],
        fontSizes: [
          [null, null],
          [null, null],
          [null, null],
        ],
        fontFamilies: [
          [null, null],
          [null, null],
          [null, null],
        ],
        aligns: [
          [null, null],
          [null, null],
          [null, null],
        ],
        vAligns: [
          [null, null],
          [null, null],
          [null, null],
        ],
        borders: [
          [null, null],
          [null, null],
          [null, null],
        ],
      },
      mergedCells: [],
    })

    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '3' } })
    expect(onUpdateElement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: [
          ['H1', 'H2', ''],
          ['A1', 'A2', ''],
        ],
      })
    )
    expect(onUpdateElement).not.toHaveBeenCalledWith({ rows: 3 })
    expect(onUpdateElement).not.toHaveBeenCalledWith({ cols: 3 })
  })
})
