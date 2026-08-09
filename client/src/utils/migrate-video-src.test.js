import { describe, expect, it } from 'vitest'
import { migrateVideoSrc, resolveVideoSrc } from './migrate-video-src'

describe('Phase 03: migrateVideoSrc canonical src contract', () => {
  it('copies videoUrl to src when src is empty', () => {
    const el = { id: 'v1', type: 'video', videoUrl: 'https://x.com/a.mp4' }
    const out = migrateVideoSrc(el)
    expect(out.src).toBe('https://x.com/a.mp4')
    expect(out.videoUrl).toBe('https://x.com/a.mp4')
  })

  it('leaves src untouched when already set and retains legacy videoUrl fallback', () => {
    const el = { id: 'v1', type: 'video', src: 'https://x.com/keep.mp4', videoUrl: 'https://x.com/old.mp4' }
    const out = migrateVideoSrc(el)
    expect(out.src).toBe('https://x.com/keep.mp4')
    expect(out.videoUrl).toBe('https://x.com/old.mp4')
  })

  it('treats an explicit blank src as a source clear', () => {
    expect(resolveVideoSrc({
      id: 'v1',
      type: 'video',
      src: '',
      videoUrl: 'https://x.com/legacy.mp4',
    })).toBe('')
  })

  it('is idempotent for migrated legacy video elements', () => {
    const el = { id: 'v1', type: 'video', videoUrl: 'https://x.com/a.mp4' }
    const once = migrateVideoSrc(el)
    const twice = migrateVideoSrc(once)
    expect(twice).toEqual(once)
  })

  it('does not let stale videoUrl override an explicit src edit', () => {
    const el = { id: 'v1', type: 'video', src: 'https://x.com/new.mp4', videoUrl: 'https://x.com/old.mp4' }
    expect(migrateVideoSrc(el).src).toBe('https://x.com/new.mp4')
  })

  it('is a no-op for non-video elements', () => {
    const el = { id: 't1', type: 'text', videoUrl: 'should-not-copy' }
    expect(migrateVideoSrc(el).src).toBeUndefined()
  })

  it('is a no-op for a video with neither field', () => {
    const el = { id: 'v1', type: 'video' }
    expect(migrateVideoSrc(el)).toEqual(el)
  })
})
