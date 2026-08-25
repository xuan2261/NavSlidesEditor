import { describe, expect, it } from 'vitest'
import { isSafeHref, resolveUrlEntry, sanitizeMediaSrc } from './url-safety'

describe('url-safety media policy', () => {
  it('keeps ordinary links policy separate from media src policy', () => {
    expect(isSafeHref('mailto:person@example.com')).toBe(true)
    expect(sanitizeMediaSrc('mailto:person@example.com')).toBe('')
  })

  it('allows project-relative, upload, http(s), and safe media data URLs', () => {
    expect(sanitizeMediaSrc('/uploads/a.mp4')).toBe('/uploads/a.mp4')
    expect(sanitizeMediaSrc('./media/a.mp3')).toBe('./media/a.mp3')
    expect(sanitizeMediaSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(sanitizeMediaSrc('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    expect(sanitizeMediaSrc('data:video/mp4;base64,abc')).toBe('data:video/mp4;base64,abc')
  })

  it('neutralizes executable, local file, unsafe data, and attribute-breakout media URLs', () => {
    expect(sanitizeMediaSrc('javascript:alert(1)')).toBe('')
    expect(sanitizeMediaSrc('file:///c:/secret.mp4')).toBe('')
    expect(sanitizeMediaSrc('data:text/html,<script>alert(1)</script>')).toBe('')
    expect(sanitizeMediaSrc('https://example.com/a.mp4" onerror="alert(1)')).toBe('')
  })

  it('enforces the requested data URL media kind', () => {
    expect(resolveUrlEntry(' data:image/png;base64,abc ', 'image')).toEqual({
      value: 'data:image/png;base64,abc',
      error: '',
    })
    expect(resolveUrlEntry('data:video/mp4;base64,abc', 'image')).toEqual({
      value: '',
      error: 'Enter an image data URL, not video.',
    })
    expect(resolveUrlEntry('data:image/png;base64,abc', 'video')).toEqual({
      value: '',
      error: 'Enter a video data URL, not image.',
    })
  })

  it('normalizes safe links and rejects attribute breakout values', () => {
    expect(resolveUrlEntry(' tel:+1234567890 ', 'link')).toEqual({
      value: 'tel:+1234567890',
      error: '',
    })
    expect(resolveUrlEntry('/slide" onclick="evil()', 'link').error).toBeTruthy()
  })
})
