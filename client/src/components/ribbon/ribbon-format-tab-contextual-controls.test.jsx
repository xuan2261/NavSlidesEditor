import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FormatTabContent from './ribbon-format-tab-element-position-size-rotation-controls'

const baseElement = {
  id: 'el-1',
  x: 100, y: 200, width: 300, height: 150,
  rotation: 0, locked: false,
}

describe('FormatTabContent — contextual controls', () => {
  describe('no selection', () => {
    it('shows placeholder when no element selected', () => {
      render(<FormatTabContent />)
      expect(screen.getByText('Select an element to format')).toBeTruthy()
    })
  })

  describe('shape element', () => {
    const shape = { ...baseElement, type: 'shape', fill: '#ff0000', stroke: '#000000', strokeWidth: 2 }

    it('shows fill and stroke controls for shape', () => {
      render(<FormatTabContent selectedElement={shape} />)
      expect(screen.getByLabelText('Fill color')).toBeTruthy()
      expect(screen.getByLabelText('Stroke color')).toBeTruthy()
    })

    it('shows stroke width input for shape', () => {
      render(<FormatTabContent selectedElement={shape} />)
      expect(screen.getByLabelText('Stroke width')).toBeTruthy()
    })

    it('calls onUpdateElement for fill change', () => {
      const onUpdateElement = vi.fn()
      render(<FormatTabContent selectedElement={shape} onUpdateElement={onUpdateElement} />)
      fireEvent.change(screen.getByLabelText('Fill color'), { target: { value: '#00ff00' } })
      expect(onUpdateElement).toHaveBeenCalledWith({ fill: '#00ff00' })
    })
  })

  describe('image element', () => {
    const image = { ...baseElement, type: 'image', src: 'test.png', objectFit: 'cover', alt: 'test image' }

    it('shows object fit control for image', () => {
      render(<FormatTabContent selectedElement={image} />)
      expect(screen.getByLabelText('Object fit')).toBeTruthy()
    })

    it('shows alt text input for image', () => {
      render(<FormatTabContent selectedElement={image} />)
      expect(screen.getByLabelText('Alt text')).toBeTruthy()
    })

    it('calls onUpdateElement for objectFit change', () => {
      const onUpdateElement = vi.fn()
      render(<FormatTabContent selectedElement={image} onUpdateElement={onUpdateElement} />)
      fireEvent.change(screen.getByLabelText('Object fit'), { target: { value: 'contain' } })
      expect(onUpdateElement).toHaveBeenCalledWith({ objectFit: 'contain' })
    })
  })

  describe('chart element', () => {
    const chart = { ...baseElement, type: 'chart', chartType: 'bar' }

    it('shows chart type selector', () => {
      render(<FormatTabContent selectedElement={chart} />)
      expect(screen.getByLabelText('Chart type')).toBeTruthy()
    })

    it('calls onUpdateElement for chart type change', () => {
      const onUpdateElement = vi.fn()
      render(<FormatTabContent selectedElement={chart} onUpdateElement={onUpdateElement} />)
      fireEvent.change(screen.getByLabelText('Chart type'), { target: { value: 'line' } })
      expect(onUpdateElement).toHaveBeenCalledWith({ chartType: 'line' })
    })
  })

  describe('table element', () => {
    const table = { ...baseElement, type: 'table', rows: 3, cols: 3 }

    it('shows row and column controls', () => {
      render(<FormatTabContent selectedElement={table} />)
      expect(screen.getByLabelText('Rows')).toBeTruthy()
      expect(screen.getByLabelText('Columns')).toBeTruthy()
    })
  })

  describe('video element', () => {
    const video = { ...baseElement, type: 'video', src: 'https://example.com/video.mp4' }

    it('shows source URL input', () => {
      render(<FormatTabContent selectedElement={video} />)
      expect(screen.getByLabelText('Source URL')).toBeTruthy()
    })
  })

  describe('code element', () => {
    const code = { ...baseElement, type: 'code', language: 'javascript' }

    it('shows language selector', () => {
      render(<FormatTabContent selectedElement={code} />)
      expect(screen.getByLabelText('Language')).toBeTruthy()
    })
  })

  describe('common controls for any element', () => {
    it('shows position inputs for any element', () => {
      render(<FormatTabContent selectedElement={baseElement} />)
      expect(screen.getByLabelText('X position')).toBeTruthy()
      expect(screen.getByLabelText('Y position')).toBeTruthy()
    })

    it('shows size inputs for any element', () => {
      render(<FormatTabContent selectedElement={baseElement} />)
      expect(screen.getByLabelText('Width')).toBeTruthy()
      expect(screen.getByLabelText('Height')).toBeTruthy()
    })

    it('shows rotation input for any element', () => {
      render(<FormatTabContent selectedElement={baseElement} />)
      expect(screen.getByLabelText('Rotation degrees')).toBeTruthy()
    })

    it('shows lock toggle for any element', () => {
      render(<FormatTabContent selectedElement={baseElement} />)
      expect(screen.getByLabelText('Toggle lock')).toBeTruthy()
    })

    it('shows opacity slider for any element', () => {
      render(<FormatTabContent selectedElement={baseElement} />)
      expect(screen.getByLabelText('Opacity')).toBeTruthy()
    })
  })
})
