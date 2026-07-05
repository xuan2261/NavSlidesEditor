import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SlideCanvas from './SlideCanvas'
import { useUIStore } from '../stores/ui-store'

function renderCanvas(props = {}) {
  return render(
    <SlideCanvas
      editor={null}
      slide={{ id: 's1', elements: [] }}
      selectedElementIds={[]}
      editingElementId={null}
      showGrid={false}
      resolution={{ width: 960, height: 540 }}
      persistentGuides={[]}
      onToggleSelectElement={vi.fn()}
      onStartEdit={vi.fn()}
      onStopEdit={vi.fn()}
      onUpdateElement={vi.fn()}
      onUpdateElements={vi.fn()}
      onDeleteElement={vi.fn()}
      onDeleteSelectedElements={vi.fn()}
      {...props}
    />
  )
}

describe('SlideCanvas media drop', () => {
  it('routes image, video, and audio drops through the media handler with slide coordinates', async () => {
    const onAddMedia = vi.fn(() => Promise.resolve())
    useUIStore.setState({ zoom: 1 })
    renderCanvas({ onAddMedia })
    const canvas = screen.getByTestId('canvas-area')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 960,
      height: 540,
      right: 970,
      bottom: 560,
      x: 10,
      y: 20,
      toJSON: () => {},
    })

    const event = createEvent.drop(canvas)
    Object.defineProperty(event, 'clientX', { value: 210 })
    Object.defineProperty(event, 'clientY', { value: 170 })
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files: [
          new File(['i'], 'image.png', { type: 'image/png' }),
          new File(['v'], 'video.mp4', { type: 'video/mp4' }),
          new File(['a'], 'audio.mp3', { type: 'audio/mpeg' }),
        ],
      },
    })
    fireEvent(canvas, event)

    await waitFor(() => expect(onAddMedia).toHaveBeenCalledTimes(3))
    expect(onAddMedia.mock.calls.map(([file]) => file.type)).toEqual([
      'image/png',
      'video/mp4',
      'audio/mpeg',
    ])
    expect(Number.isFinite(onAddMedia.mock.calls[0][1])).toBe(true)
    expect(Number.isFinite(onAddMedia.mock.calls[0][2])).toBe(true)
  })
})
