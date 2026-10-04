import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import MediaProperties from './media-properties'

function Editor({ initial }) {
  const [element, setElement] = useState(initial)
  return (
    <>
      <MediaProperties
        element={element}
        onUpdate={(patch) => setElement((current) => ({ ...current, ...patch }))}
      />
      <output data-testid="saved-media">{JSON.stringify(element)}</output>
    </>
  )
}

const saved = () => JSON.parse(screen.getByTestId('saved-media').textContent)

describe('media source editing', () => {
  it('applies controls visibility to an audio element', () => {
    render(<Editor initial={{ id: 'a1', type: 'audio', src: '/audio.mp3', controls: false }} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show controls' }))
    expect(saved().controls).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Show controls' }).checked).toBe(true)
  })

  it('replaces the displayed canonical source without promoting the legacy URL', () => {
    render(
      <Editor
        initial={{
          id: 'v1',
          type: 'video',
          src: 'https://cdn.example.com/current.mp4',
          videoUrl: 'https://cdn.example.com/legacy.mp4',
        }}
      />
    )
    fireEvent.change(screen.getByLabelText('Video source URL'), {
      target: { value: '/uploads/new.mp4' },
    })
    expect(saved().src).toBe('/uploads/new.mp4')
    expect(screen.getByLabelText('Video source URL').value).toBe('/uploads/new.mp4')
    fireEvent.change(screen.getByLabelText('Video source URL'), { target: { value: '' } })
    expect(saved().src).toBe('')
    expect(screen.getByLabelText('Video source URL').value).toBe('')
  })

  it('migrates an edited legacy source into canonical src and rejects script URLs', () => {
    render(
      <Editor
        initial={{ id: 'v1', type: 'video', videoUrl: 'https://legacy.example.com/old.mp4' }}
      />
    )
    const source = screen.getByLabelText('Video source URL')
    expect(source.value).toBe('https://legacy.example.com/old.mp4')
    fireEvent.change(source, { target: { value: 'javascript:alert(1)' } })
    expect(source.value).toBe('https://legacy.example.com/old.mp4')
    fireEvent.change(source, { target: { value: '/uploads/new.mp4' } })
    expect(saved().src).toBe('/uploads/new.mp4')
    expect(source.value).toBe('/uploads/new.mp4')
  })
})

describe('media accessibility properties', () => {
  it.each(['video', 'audio'])(
    'admits a portable WebVTT caption for %s without accepting executable or non-caption data',
    (type) => {
      const original = {
        src: '/uploads/en.vtt',
        srcLang: 'en',
        label: 'English',
        kind: 'captions',
        default: true,
      }
      const inlineCaption =
        'data:text/vtt;base64,' + btoa('WEBVTT\n\n00:00.050 --> 00:00.150\nCaption.\n')
      render(
        <Editor initial={{ id: 'media', type, src: '/uploads/media.webm', tracks: [original] }} />
      )
      const input = screen.getByLabelText('Caption track 1 URL')
      fireEvent.change(input, { target: { value: inlineCaption } })
      expect(saved().tracks).toEqual([{ ...original, src: inlineCaption }])
      expect(input.value).toBe(inlineCaption)
      expect(screen.queryByRole('alert')).toBeNull()
      for (const unsafe of [
        'javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdC8+',
        'data:video/webm;base64,YQ==',
      ]) {
        fireEvent.change(input, { target: { value: unsafe } })
        expect(saved().tracks).toEqual([{ ...original, src: inlineCaption }])
        expect(input.value).toBe(inlineCaption)
      }
      fireEvent.change(input, { target: { value: '' } })
      expect(saved().tracks).toEqual([{ ...original, src: '' }])
    }
  )

  it('clears an unsafe imported caption warning only after the source is replaced by valid WebVTT', () => {
    const unsafe = {
      src: 'data:text/html;base64,PHNjcmlwdC8+',
      srcLang: 'en',
      label: 'English',
      kind: 'captions',
      default: true,
    }
    render(<Editor initial={{ id: 'media', type: 'video', tracks: [unsafe] }} />)
    expect(screen.getByRole('alert')).toBeDefined()
    const src = 'data:text/vtt;base64,' + btoa('WEBVTT\n')
    fireEvent.change(screen.getByLabelText('Caption track 1 URL'), { target: { value: src } })
    expect(saved().tracks).toEqual([{ ...unsafe, src }])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each(['video', 'audio'])(
    'keeps %s caption URL focus while typing and preserves the other track',
    (type) => {
      const other = {
        src: '/uploads/fr.vtt',
        srcLang: 'fr',
        label: 'French',
        kind: 'captions',
        default: false,
      }
      render(
        <Editor
          initial={{
            id: 'media',
            type,
            tracks: [
              { src: '', srcLang: 'en', label: 'English', kind: 'captions', default: true },
              other,
            ],
          }}
        />
      )
      const input = screen.getByLabelText('Caption track 1 URL')
      input.focus()
      for (const value of ['/', '/u', '/uploads/en.vtt']) {
        fireEvent.change(input, { target: { value } })
        expect(document.activeElement).toBe(screen.getByLabelText('Caption track 1 URL'))
        expect(screen.getByLabelText('Caption track 1 URL').value).toBe(value)
        expect(saved().tracks[0].src).toBe(value)
      }
      expect(saved().tracks[1]).toEqual(other)
    }
  )

  it('[cap:media.accessibility] edits, reorders, selects the default, and removes caption tracks', () => {
    const english = {
      src: '/uploads/en.vtt',
      srcLang: 'en',
      label: 'English',
      kind: 'captions',
      default: true,
    }
    const french = {
      src: '/uploads/fr.vtt',
      srcLang: 'fr',
      label: 'French',
      kind: 'captions',
      default: false,
    }
    render(<Editor initial={{ id: 'v1', type: 'video', tracks: [english, french] }} />)
    fireEvent.change(screen.getByLabelText('Caption track 2 label'), {
      target: { value: 'French subtitles' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Up' })[1])
    expect(screen.getByLabelText('Caption track 1 label').value).toBe('French subtitles')
    expect(saved().tracks.map((track) => track.src)).toEqual([french.src, english.src])
    fireEvent.click(screen.getByLabelText('Caption track 1 default'))
    expect(saved().tracks.map((track) => track.default)).toEqual([true, false])
    const firstRow = screen.getByLabelText('Caption track 1')
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Remove' }))
    expect(saved().tracks).toEqual([{ ...english, default: false }])
    expect(screen.getByLabelText('Caption track 1 label').value).toBe('English')
  })

  it('disables media metadata editing on locked elements', () => {
    render(
      <Editor
        initial={{
          id: 'a1',
          type: 'audio',
          locked: true,
          transcript: 'Original transcript',
          tracks: [],
        }}
      />
    )
    expect(screen.getByLabelText('Media transcript').disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Add track' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Add track' }))
    expect(saved().tracks).toEqual([])
  })
})
