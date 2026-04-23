import { describe, expect, it } from 'vitest'
import {
  buildArchiveMediaManifestEntries,
  collectProjectMediaEntries,
  getBackgroundImageUrl,
  isLocalProjectMediaUrl,
  rewriteProjectMediaUrls,
} from './project-media-utils'

describe('project-media-utils', () => {
  it('detects local upload URLs in relative and absolute form', () => {
    expect(isLocalProjectMediaUrl('/uploads/demo.png')).toBe(true)
    expect(isLocalProjectMediaUrl('https://demo.test/uploads/demo.png')).toBe(true)
    expect(isLocalProjectMediaUrl('https://cdn.test/demo.png')).toBe(false)
  })

  it('reads canonical and legacy background image fields', () => {
    expect(getBackgroundImageUrl({ type: 'image', image: '/uploads/bg.png' })).toBe('/uploads/bg.png')
    expect(getBackgroundImageUrl({ type: 'image', src: '/uploads/bg-legacy.png' })).toBe(
      '/uploads/bg-legacy.png'
    )
  })

  it('collects src, poster, and background media refs', () => {
    const entries = collectProjectMediaEntries({
      slides: [
        {
          background: { type: 'image', image: '/uploads/bg.png' },
          elements: [
            { id: 'i1', type: 'image', src: '/uploads/photo.png' },
            { id: 'v1', type: 'video', src: '/uploads/video.mp4', poster: '/uploads/video.png' },
          ],
        },
      ],
    })

    expect(entries.map((entry) => entry.originalUrl)).toEqual([
      '/uploads/bg.png',
      '/uploads/photo.png',
      '/uploads/video.mp4',
      '/uploads/video.png',
    ])
  })

  it('creates deterministic unique archive paths for duplicate basenames', () => {
    const entries = buildArchiveMediaManifestEntries({
      slides: [
        { elements: [{ type: 'image', src: '/uploads/team/photo.png' }] },
        { elements: [{ type: 'image', src: 'https://old-host.test/uploads/other/photo.png' }] },
      ],
    })

    expect(entries).toHaveLength(2)
    expect(entries[0].filename).toBe('photo.png')
    expect(entries[1].filename).toBe('photo.png')
    expect(entries[0].archivePath).not.toBe(entries[1].archivePath)
  })

  it('rewrites canonical and legacy media URLs without mutating source', () => {
    const presentation = {
      slides: [
        {
          background: { type: 'image', src: '/uploads/bg-old.png' },
          elements: [
            { type: 'image', src: '/uploads/image-old.png' },
            { type: 'video', src: '/uploads/video-old.mp4', poster: '/uploads/poster-old.png' },
          ],
        },
      ],
    }

    const result = rewriteProjectMediaUrls(presentation, {
      '/uploads/bg-old.png': '/uploads/bg-new.png',
      '/uploads/image-old.png': '/uploads/image-new.png',
      '/uploads/video-old.mp4': '/uploads/video-new.mp4',
      '/uploads/poster-old.png': '/uploads/poster-new.png',
    })

    expect(result.slides[0].background.image).toBe('/uploads/bg-new.png')
    expect(result.slides[0].elements[0].src).toBe('/uploads/image-new.png')
    expect(result.slides[0].elements[1].src).toBe('/uploads/video-new.mp4')
    expect(result.slides[0].elements[1].poster).toBe('/uploads/poster-new.png')
    expect(presentation.slides[0].background.src).toBe('/uploads/bg-old.png')
  })
})
