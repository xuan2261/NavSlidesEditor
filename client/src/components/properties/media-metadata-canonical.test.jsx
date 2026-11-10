// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import MediaProperties from './media-properties'
import { editMediaPlaybackOccurrence } from 'revealjs-shared/src/pptx-media-operations.js'
import { mediaCompatibilityElement } from 'revealjs-shared/src/pptx-media-document.js'
import { renderSlideElements } from 'revealjs-shared/src/element-renderers.js'

afterEach(cleanup)
const source = { embeddedComponentId: 'embedded', legacyComponentId: 'legacy',
  asset: { src: '/uploads/movie.mp4' }, poster: { src: '/uploads/original.png' } }
function Editor() {
  const [document, setDocument] = useState({ definitions: { media: { content: { mediaDocument: source } } },
    instances: { occurrence: { definitionId: 'media', overrides: {} } } })
  const element = mediaCompatibilityElement(document, {
    id: 'video', pptxInstanceId: 'occurrence', type: 'video', x: 0, y: 0, width: 320, height: 180,
  })
  return <>
    <MediaProperties element={element} onUpdate={(patch) => setDocument((previous) =>
      editMediaPlaybackOccurrence(previous, 'occurrence', 'embedded', patch))} />
    <div data-testid="preview" dangerouslySetInnerHTML={{ __html: renderSlideElements({ elements: [element] }) }} />
    <output data-testid="canonical">{JSON.stringify(document.instances.occurrence.overrides)}</output>
  </>
}
const canonical = () => JSON.parse(screen.getByTestId('canonical').textContent)

describe('canonical media metadata inspector consumer', () => {
  it('keeps caption drafts usable without committing partial or unsafe resource URLs', () => {
    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: 'Add track' }))
    expect(screen.getByTestId('preview').querySelector('track')).toBeNull()
    const input = screen.getByLabelText('Caption track 1 URL')
    for (const value of ['/', '/uploads/', '/uploads/en.vtt']) {
      fireEvent.change(input, { target: { value } })
      expect(input.value).toBe(value)
    }
    expect(canonical().components.embedded.mediaPlayback.tracks[0].src).toBe('/uploads/en.vtt')
    expect(screen.getByTestId('preview').querySelector('track').getAttribute('src')).toContain('/uploads/en.vtt')
    fireEvent.change(input, { target: { value: ' /uploads/en.vtt' } })
    expect(input.value).toBe(' /uploads/en.vtt')
    expect(canonical().components.embedded.mediaPlayback.tracks[0].src).toBe('/uploads/en.vtt')
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } })
    expect(canonical().components.embedded.mediaPlayback.tracks[0].src).toBe('/uploads/en.vtt')
  })

  it('renders a complete transcript draft and a poster only after valid authoring', () => {
    render(<Editor />)
    fireEvent.change(screen.getByLabelText('Media transcript'), { target: { value: 'A ' } })
    expect(canonical().components.embedded.mediaPlayback.transcript).toBe('A ')
    fireEvent.change(screen.getByLabelText('Media transcript'), { target: { value: 'A sentence.' } })
    expect(screen.getByTestId('preview').textContent).toContain('A sentence.')
    fireEvent.change(screen.getByLabelText('Video poster image URL'), { target: { value: '/uploads/new.png' } })
    expect(screen.getByTestId('preview').querySelector('video').getAttribute('poster')).toContain('/uploads/new.png')
    expect(screen.getByLabelText('Video source URL').disabled).toBe(true)
  })
})
