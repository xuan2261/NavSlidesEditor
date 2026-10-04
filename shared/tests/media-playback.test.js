import { describe, expect, it, vi } from 'vitest'
import { attachMediaPlayback } from '../src/media-playback.js'

function mediaFixture(duration = 2) {
  const frames = new Map()
  let nextFrame = 0
  const media = new EventTarget()
  Object.assign(media, {
    currentTime: 0,
    duration,
    paused: true,
    ended: false,
    loop: false,
    playbackRate: 1,
    ownerDocument: {
      defaultView: {
        requestAnimationFrame(callback) {
          const id = ++nextFrame
          frames.set(id, callback)
          return id
        },
        cancelAnimationFrame(id) {
          frames.delete(id)
        },
      },
    },
    play() {
      this.paused = false
      this.ended = false
      this.dispatchEvent(new Event('play'))
      return Promise.resolve()
    },
    pause() {
      this.paused = true
      this.dispatchEvent(new Event('pause'))
    },
  })
  return {
    media,
    event(name) {
      media.dispatchEvent(new Event(name))
    },
    frame() {
      const pending = [...frames.values()]
      frames.clear()
      for (const callback of pending) callback()
    },
    advance(time) {
      media.currentTime = time
      media.dispatchEvent(new Event('timeupdate'))
    },
    frames,
  }
}

describe('authored media playback segment', () => {
  it('begins at the authored start and loops only the selected segment', async () => {
    const { media, advance } = mediaFixture()
    const detach = attachMediaPlayback(media, {
      startTime: 0.2,
      endTime: 0.8,
      loop: true,
      playbackRate: 1.5,
    })
    expect(media.currentTime).toBe(0.2)
    expect(media.playbackRate).toBe(1.5)
    await media.play()
    advance(0.79)
    expect(media.currentTime).toBe(0.79)
    advance(0.8)
    expect(media.currentTime).toBe(0.2)
    expect(media.paused).toBe(false)
    advance(0.81)
    expect(media.currentTime).toBe(0.2)
    detach()
  })

  it('enforces the segment boundary between native timeupdate events', async () => {
    const { media, frame } = mediaFixture()
    const detach = attachMediaPlayback(media, { startTime: 0.2, endTime: 0.8, loop: true })
    await media.play()
    media.currentTime = 0.81
    frame()
    expect(media.currentTime).toBe(0.2)
    expect(media.paused).toBe(false)
    detach()
  })

  it('stops exactly at the selected end without looping and can replay from start', async () => {
    const { media, advance } = mediaFixture()
    const detach = attachMediaPlayback(media, { startTime: 0.2, endTime: 0.8, loop: false })
    await media.play()
    advance(0.9)
    expect(media.currentTime).toBe(0.8)
    expect(media.paused).toBe(true)
    await media.play()
    expect(media.currentTime).toBe(0.2)
    expect(media.paused).toBe(false)
    detach()
  })

  it('does not resume a user-paused loop when the playhead is moved to the end', async () => {
    const { media, advance, frames } = mediaFixture()
    const detach = attachMediaPlayback(media, { startTime: 0.2, endTime: 0.8, loop: true })
    await media.play()
    media.pause()
    advance(0.8)
    expect(media.paused).toBe(true)
    expect(media.currentTime).toBe(0.8)
    expect(frames.size).toBe(0)
    detach()
  })

  it('loops a start-only segment back to the authored start at the resource end', async () => {
    const { media, event } = mediaFixture()
    const detach = attachMediaPlayback(media, { startTime: 0.4, loop: true })
    media.currentTime = 2
    media.paused = true
    media.ended = true
    event('ended')
    expect(media.currentTime).toBe(0.4)
    expect(media.paused).toBe(false)
    detach()
  })

  it('clamps the segment to loaded duration and ignores impossible or invalid intervals', () => {
    const { media, event } = mediaFixture(NaN)
    const detach = attachMediaPlayback(media, { startTime: 0.4, endTime: 5, playbackRate: -1 })
    media.duration = 1
    event('loadedmetadata')
    media.currentTime = 1.2
    event('timeupdate')
    expect(media.currentTime).toBe(1)
    expect(media.paused).toBe(true)
    expect(media.playbackRate).toBe(1)
    detach()
    const detachInvalid = attachMediaPlayback(media, { startTime: 4, endTime: -1 })
    expect(media.currentTime).toBe(0)
    media.currentTime = 0.9
    event('timeupdate')
    expect(media.currentTime).toBe(0.9)
    detachInvalid()
  })

  it('removes the old boundary when detached before an interval edit', async () => {
    const { media, advance, frames } = mediaFixture()
    const detach = attachMediaPlayback(media, { startTime: 0.2, endTime: 0.8, loop: true })
    await media.play()
    detach()
    expect(frames.size).toBe(0)
    advance(0.9)
    expect(media.currentTime).toBe(0.9)
    const detachNext = attachMediaPlayback(media, { startTime: 0.4, endTime: 1.5, loop: false })
    advance(0.9)
    expect(media.currentTime).toBe(0.9)
    expect(media.paused).toBe(false)
    advance(1.6)
    expect(media.currentTime).toBe(1.5)
    expect(media.paused).toBe(true)
    detachNext()
  })

  it('keeps failed loop playback paused and exposes the playback error', async () => {
    const { media, event } = mediaFixture()
    const failure = new Error('Decoder failed')
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const detach = attachMediaPlayback(media, { startTime: 0.2, loop: true })
    try {
      media.play = () => Promise.reject(failure)
      media.ended = true
      event('ended')
      await Promise.resolve()
      expect(media.paused).toBe(true)
      expect(media.currentTime).toBe(0.2)
      expect(report.mock.calls.some((args) => args.includes(failure))).toBe(true)
    } finally {
      detach()
      report.mockRestore()
    }
  })
})
