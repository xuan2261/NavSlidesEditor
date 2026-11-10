// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { renderSlideElements } from '../src/element-renderers'
import { attachMediaPlaybackRoot } from '../src/media-playback-root'
import { attachMediaPlayback } from '../src/media-playback'

afterEach(() => { document.body.replaceChildren() })

describe('exported media volume runtime', () => {
  it.each(['audio', 'video'])('applies serialized %s volume to a real HTMLMediaElement', (type) => {
    document.body.innerHTML = renderSlideElements({ id: 'slide', elements: [{
      id: 'media', type, x: 0, y: 0, width: 320, height: 180,
      src: '/uploads/media.webm', volume: 0.25, muted: false,
    }] })
    const media = document.querySelector(type)
    const dispose = attachMediaPlaybackRoot(document.body, attachMediaPlayback)
    expect(media).toBeInstanceOf(HTMLMediaElement)
    expect(media.volume).toBe(0.25)
    expect(media.muted).toBe(false)
    media.dispatchEvent(new Event('loadedmetadata'))
    expect(media.volume).toBe(0.25)
    dispose()
  })

  it('preserves zero instead of treating it as an absent volume', () => {
    const media = document.createElement('audio')
    document.body.append(media)
    const dispose = attachMediaPlayback(media, { volume: 0 })
    expect(media.volume).toBe(0)
    dispose()
    const reset = attachMediaPlayback(media)
    expect(media.volume).toBe(1)
    reset()
  })
})
