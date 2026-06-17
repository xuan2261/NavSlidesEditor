import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CodeProperties from './code-properties'
import ImageProperties from './image-properties'
import MediaProperties from './media-properties'
import MiscProperties from './misc-properties'

describe('canonical media/code/image/latex/html property depth', () => {
  it('[cap:element.image depth:behavior] writes objectFit from the image properties select', () => {
    const onUpdate = vi.fn()
    render(<ImageProperties element={{ id: 'img-1', type: 'image', objectFit: 'contain' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-image-object-fit'), { target: { value: 'cover' } })

    expect(onUpdate).toHaveBeenCalledWith({ objectFit: 'cover' })
  })

  it('[cap:element.image depth:behavior] exposes round corners but not image border width/color authoring', () => {
    render(
      <ImageProperties
        element={{ id: 'img-1', type: 'image', borderRadius: 12, borderColor: '#ff0000', borderWidth: 3 }}
        onUpdate={vi.fn()}
      />
    )

    expect(screen.getByTestId('prop-image-border-radius')).toBeTruthy()
    expect(screen.queryByTestId('prop-image-border-color')).toBeNull()
    expect(screen.queryByTestId('prop-image-border-width')).toBeNull()
  })

  it('[cap:element.code depth:behavior] writes language from the code properties select', () => {
    const onUpdate = vi.fn()
    render(<CodeProperties element={{ id: 'code-1', type: 'code', language: 'javascript' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-code-language'), { target: { value: 'python' } })

    expect(onUpdate).toHaveBeenCalledWith({ language: 'python' })
  })

  it('[cap:element.code depth:behavior] writes font size and border radius from code properties', () => {
    const onUpdate = vi.fn()
    render(<CodeProperties element={{ id: 'code-1', type: 'code', fontSize: 14, borderRadius: 4 }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-code-font-size'), { target: { value: '20' } })
    fireEvent.change(screen.getByTestId('prop-code-border-radius'), { target: { value: '16' } })

    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 20 })
    expect(onUpdate).toHaveBeenCalledWith({ borderRadius: 16 })
  })

  it('[cap:element.video depth:behavior] writes trim and playback properties', () => {
    const onUpdate = vi.fn()
    render(<MediaProperties element={{ id: 'video-1', type: 'video', src: '/demo.mp4' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-video-start-time'), { target: { value: '5' } })
    fireEvent.change(screen.getByTestId('prop-video-playback-rate'), { target: { value: '1.5' } })

    expect(onUpdate).toHaveBeenCalledWith({ startTime: 5 })
    expect(onUpdate).toHaveBeenCalledWith({ playbackRate: 1.5 })
  })

  it('[cap:element.audio depth:behavior] writes the single audio source field', () => {
    const onUpdate = vi.fn()
    render(<MediaProperties element={{ id: 'audio-1', type: 'audio', src: '/old.mp3' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByDisplayValue('/old.mp3'), { target: { value: '/new.mp3' } })

    expect(onUpdate).toHaveBeenCalledWith({ src: '/new.mp3' })
  })

  it('[cap:element.latex depth:behavior] writes latex font size and text color', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={{ id: 'latex-1', type: 'latex', fontSize: 16, textColor: '#ffffff' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-latex-font-size'), { target: { value: '28' } })
    fireEvent.change(screen.getByTestId('prop-latex-text-color'), { target: { value: '#10b981' } })

    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 28 })
    expect(onUpdate).toHaveBeenCalledWith({ textColor: '#10b981' })
  })

  it('[cap:element.html depth:behavior] routes html editing through the edit callback', () => {
    const onEditHtml = vi.fn()
    render(<MiscProperties element={{ id: 'html-1', type: 'html' }} onUpdate={vi.fn()} onEditHtml={onEditHtml} />)

    fireEvent.click(screen.getByTestId('prop-html-edit'))

    expect(onEditHtml).toHaveBeenCalledTimes(1)
  })

  it('[cap:element.markdown depth:behavior] writes markdown content, text color, and font size', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={{ id: 'markdown-1', type: 'markdown', content: '# Old' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-markdown-content'), { target: { value: '## New' } })
    fireEvent.change(screen.getByTestId('prop-markdown-text-color'), { target: { value: '#22c55e' } })
    fireEvent.change(screen.getByTestId('prop-markdown-font-size'), { target: { value: '28' } })

    expect(onUpdate).toHaveBeenCalledWith({ content: '## New' })
    expect(onUpdate).toHaveBeenCalledWith({ textColor: '#22c55e' })
    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 28 })
  })
})
