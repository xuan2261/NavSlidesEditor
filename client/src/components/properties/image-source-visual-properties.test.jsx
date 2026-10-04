import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ImageProperties from './image-properties'
import CanvasElement from '../canvas/canvas-element-wrapper'
import { SlideThumbnailPreview } from '../slide-panel/slide-thumbnail-preview'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'
import { hasPptxImageVisualEffects } from 'revealjs-shared'

const image = {
  id: 'primary',
  type: 'image',
  x: 20,
  y: 30,
  width: 200,
  height: 100,
  src: '/uploads/old.png',
}
function ImageEditor({ locked = false, mixed = false }) {
  const [elements, setElements] = useState([
    { ...image, locked },
    {
      ...image,
      id: 'second',
      ...(mixed ? { src: '/uploads/second.png', flipH: true, filterSepia: 20, filterBlur: 2 } : {}),
    },
    { ...image, id: 'locked', locked: true },
    { id: 'text', type: 'text', content: 'Text' },
  ])
  const ids = elements.map((item) => item.id)
  const update = (patch) =>
    setElements((current) => {
      const updates = buildSelectionUpdates(current, ids, 'primary', patch)
      return current.map((item) => ({ ...item, ...updates.find((entry) => entry.id === item.id) }))
    })
  return (
    <>
      <ImageProperties
        element={elements[0]}
        elements={elements}
        selectedElementIds={ids}
        onUpdate={update}
      />
      <CanvasElement element={elements[0]} iconPaths={{}} />
      <SlideThumbnailPreview slide={{ elements: [elements[0]] }} data-testid="thumbnail" />
      <output data-testid="saved-data">{JSON.stringify(elements)}</output>
      <button onClick={() => setElements(JSON.parse(JSON.stringify(elements)))}>Reopen</button>
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('saved-data').textContent)

describe('image source, flips and filter authoring', () => {
  it('renders newly authored source and visual effects after fanout and reopening without writing other types or locked images', () => {
    render(<ImageEditor />)
    fireEvent.change(screen.getByLabelText('Image source URL'), {
      target: { value: '/uploads/new.png' },
    })
    fireEvent.click(screen.getByLabelText('Image horizontal flip'))
    fireEvent.click(screen.getByLabelText('Image vertical flip'))
    fireEvent.change(screen.getByLabelText('Image sepia'), { target: { value: '65' } })
    fireEvent.change(screen.getByLabelText('Image blur'), { target: { value: '4' } })
    fireEvent.click(screen.getByText('Reopen'))
    const changes = {
      src: '/uploads/new.png',
      flipH: true,
      flipV: true,
      filterSepia: 65,
      filterBlur: 4,
    }
    expect(saved()[0]).toMatchObject(changes)
    expect(saved()[1]).toMatchObject(changes)
    expect(saved()[2].src).toBe('/uploads/old.png')
    expect(saved()[2]).not.toHaveProperty('filterSepia')
    expect(saved()[3]).not.toHaveProperty('src')
    expect(saved()[3]).not.toHaveProperty('flipH')
    const canvasImage = screen.getByTestId('slide-element-primary').querySelector('img')
    const thumbnailImage = screen.getByTestId('thumbnail').querySelector('img')
    for (const rendered of [canvasImage, thumbnailImage]) {
      expect(rendered.getAttribute('src')).toBe('/uploads/new.png')
      expect(rendered.style.transform).toBe('scaleX(-1) scaleY(-1)')
      expect(rendered.style.filter).toBe('sepia(65%) blur(4px)')
    }
  })

  it('represents mixed legacy values and explicitly applies primary source, flips and effects', () => {
    render(<ImageEditor mixed />)
    expect(screen.getByLabelText('Image source URL').value).toBe('')
    expect(screen.getByLabelText('Image source URL').getAttribute('data-mixed')).toBe('true')
    expect(screen.getByLabelText('Image horizontal flip').indeterminate).toBe(true)
    expect(screen.getByLabelText('Image sepia').getAttribute('data-mixed')).toBe('true')
    fireEvent.click(
      screen.getByLabelText('Apply primary image source URL to all selected elements')
    )
    fireEvent.click(
      screen.getByLabelText('Apply primary image horizontal flip to all selected elements')
    )
    fireEvent.click(screen.getByLabelText('Apply primary image sepia to all selected elements'))
    fireEvent.click(screen.getByLabelText('Apply primary image blur to all selected elements'))
    expect(saved()[1]).toMatchObject({
      src: '/uploads/old.png',
      flipH: false,
      filterSepia: 0,
      filterBlur: 0,
    })
    expect(screen.getByLabelText('Image horizontal flip').indeterminate).toBe(false)
  })

  it('disables new edits and primary apply for a locked image', () => {
    render(<ImageEditor locked mixed />)
    for (const label of [
      'Image source URL',
      'Image horizontal flip',
      'Image vertical flip',
      'Image sepia',
      'Image blur',
    ]) {
      expect(screen.getByLabelText(label).disabled).toBe(true)
    }
    const apply = screen.queryByLabelText('Apply primary image sepia to all selected elements')
    expect(apply === null || apply.disabled).toBe(true)
    expect(saved()[1].filterSepia).toBe(20)
  })

  it.each(['filterSepia', 'filterBlur'])(
    'requires raster rendering for %s so static PPTX cannot silently discard the authored effect',
    (key) => {
      expect(hasPptxImageVisualEffects({ ...image, [key]: 10 })).toBe(true)
      expect(hasPptxImageVisualEffects({ ...image, [key]: 0 })).toBe(false)
      expect(hasPptxImageVisualEffects({ ...image, [key]: 'invalid' })).toBe(false)
    }
  )
})
