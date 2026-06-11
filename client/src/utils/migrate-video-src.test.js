import { describe, expect, it } from 'vitest'
import { migrateVideoSrc } from './migrate-video-src'

describe('Phase 2: migrateVideoSrc (videoUrl → src back-compat)', () => {
  it('copies videoUrl to src when src is empty', () => {
    const el = { id: 'v1', type: 'video', videoUrl: 'https://x.com/a.mp4' }
    const out = migrateVideoSrc(el)
    expect(out.src).toBe('https://x.com/a.mp4')
    // videoUrl must be dropped so the renderer's `videoUrl || src` fallback
    // can't shadow a later edit to src.
    expect('videoUrl' in out).toBe(false)
  })

  it('leaves src untouched when already set and drops the stale videoUrl', () => {
    const el = { id: 'v1', type: 'video', src: 'https://x.com/keep.mp4', videoUrl: 'https://x.com/old.mp4' }
    const out = migrateVideoSrc(el)
    expect(out.src).toBe('https://x.com/keep.mp4')
    expect('videoUrl' in out).toBe(false)
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
