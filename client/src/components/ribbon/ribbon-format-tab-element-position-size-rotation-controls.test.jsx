import { describe, expect, it, vi } from 'vitest'
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

  it('calls onUpdateElement for 90° rotation button', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)
    fireEvent.mouseDown(screen.getByLabelText('Rotate 90 degrees'))
    expect(onUpdateElement).toHaveBeenCalledWith({ rotation: 90 })
  })

  it('activates rotate and lock controls with keyboard', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)

    fireEvent.keyDown(screen.getByLabelText('Rotate 90 degrees'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('Toggle lock'), { key: ' ' })

    expect(onUpdateElement).toHaveBeenCalledWith({ rotation: 90 })
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

  it('renders alignment buttons', () => {
    render(<FormatTabContent selectedElement={mockElement} />)
    expect(screen.getByLabelText('Align left')).toBeTruthy()
    expect(screen.getByLabelText('Align center horizontal')).toBeTruthy()
    expect(screen.getByLabelText('Align right')).toBeTruthy()
  })

  it('calls onUpdateElement for align center', () => {
    const onUpdateElement = vi.fn()
    render(<FormatTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />)
    fireEvent.mouseDown(screen.getByLabelText('Align center horizontal'))
    expect(onUpdateElement).toHaveBeenCalledWith({ x: 330 })
  })

  it('uses custom slide width for horizontal center and right alignment without breaking mixed fields', () => {
    const onUpdateElement = vi.fn()
    render(
      <FormatTabContent
        selectedElement={mockElement}
        onUpdateElement={onUpdateElement}
        slideWidth={1600}
        elements={[mockElement, { ...mockElement, id: 'el-2', x: 200 }]}
        selectedElementIds={['el-1', 'el-2']}
      />
    )

    expect(screen.getByLabelText('X position').value).toBe('')
    expect(screen.getByLabelText('X position').placeholder).toBe('—')
    fireEvent.mouseDown(screen.getByLabelText('Align center horizontal'))
    expect(onUpdateElement).toHaveBeenLastCalledWith({ x: 650 })
    fireEvent.mouseDown(screen.getByLabelText('Align right'))
    expect(onUpdateElement).toHaveBeenLastCalledWith({ x: 1300 })
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
          cellStyles: { textColors: [['#fff', null], [null, null]] },
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

describe('icon consistency pass — align identity', () => {
  it('Format tab align L/C-h/R icons match arrange-controls.jsx by component identity', async () => {
    const formatModule = await import(
      './ribbon-format-tab-element-position-size-rotation-controls.jsx?raw'
    ).catch(() => null)

    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const here = path.dirname(fileURLToPath(import.meta.url))

    const formatSrc =
      formatModule?.default ??
      readFileSync(
        path.resolve(here, 'ribbon-format-tab-element-position-size-rotation-controls.jsx'),
        'utf8',
      )
    const arrangeSrc = readFileSync(
      path.resolve(here, 'controls/arrange-controls.jsx'),
      'utf8',
    )

    function pickAlign(src, ariaLabel) {
      const m = src.match(
        new RegExp(
          `aria-label="${ariaLabel}"[\\s\\S]*?<([A-Z][A-Za-z0-9]+)\\s+size=\\{14\\}`,
        ),
      )
      return m?.[1]
    }

    const formatLeft = pickAlign(formatSrc, 'Align left')
    const formatCenterH = pickAlign(formatSrc, 'Align center horizontal')
    const formatRight = pickAlign(formatSrc, 'Align right')

    // arrange-controls drives align icons through ALIGN_ACTIONS array; pull
    // the icon component by name from that table.
    function pickArrange(name) {
      const m = arrangeSrc.match(
        new RegExp(`\\['${name}',\\s*([A-Z][A-Za-z0-9]+),`),
      )
      return m?.[1]
    }
    const arrangeLeft = pickArrange('left')
    const arrangeCenterH = pickArrange('center-h')
    const arrangeRight = pickArrange('right')

    expect(formatLeft).toBeTruthy()
    expect(arrangeLeft).toBeTruthy()
    expect(formatLeft).toBe(arrangeLeft)
    expect(formatCenterH).toBe(arrangeCenterH)
    expect(formatRight).toBe(arrangeRight)
  })
})
