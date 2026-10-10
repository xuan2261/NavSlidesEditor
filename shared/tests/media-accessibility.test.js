import { describe, expect, it } from 'vitest'
import {
  normalizeMediaTrack,
  normalizeMediaTracks,
  normalizeMediaAccessibility,
  getMediaAccessibilityFindings,
} from '../src/media-accessibility.js'
import { sanitizeMediaSrc } from '../src/content-safety.js'

const inlineCaption =
  'data:text/vtt;base64,' +
  Buffer.from('WEBVTT\n\n00:00.050 --> 00:00.150\nCaption.\n').toString('base64')
const track = (src) => ({ src, srcLang: 'en', label: 'English', kind: 'captions', default: true })

describe('caption track source boundary', () => {
  it.each(['video', 'audio'])(
    'preserves a portable WebVTT track and canonical language when normalizing %s',
    (type) => {
      const element = { type, src: '/uploads/media.webm', tracks: [track(inlineCaption)] }
      const normalized = normalizeMediaAccessibility(element)
      expect(normalized.tracks).toEqual([track(inlineCaption)])
      expect(getMediaAccessibilityFindings(normalized)).toEqual([])
      expect(sanitizeMediaSrc(inlineCaption)).toBe('')
    }
  )

  it.each([
    'https://captions.example/en.vtt',
    'http://localhost:3002/uploads/en.vtt',
    '/uploads/en.vtt',
    './captions/en.vtt',
    '../captions/en.vtt',
  ])('retains existing HTTP and local caption resource policy for %s', (src) => {
    expect(normalizeMediaTrack(track(src))).toEqual(track(src))
  })

  it.each([
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'data:text/plain;base64,V0VCVlRUCg==',
    'data:application/javascript;base64,YWxlcnQoMSk=',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:audio/wav;base64,YQ==',
    'data:text/vtt,WEBVTT%0A',
    'data:text/vtt;charset=utf-8;base64,V0VCVlRUCg==',
    'data:text/vtt;base64,',
    'data:text/vtt;base64,V0VCVlRUCg=',
    'data:text/vtt;base64,V0VCVlRUCg==\" onload=\"alert(1)',
    'data:text/vtt;base64,V0VC\nVlRUCg==',
    'javascript:alert(1)',
    'file:///C:/private/en.vtt',
    '/uploads/en.vtt\" onload=\"alert(1)',
  ])('drops unsafe or invalid caption source %s without changing general media policy', (src) => {
    expect(normalizeMediaTrack(track(src))).toBeNull()
    expect(normalizeMediaTracks([track(src), track('/uploads/safe.vtt')])).toEqual([
      track('/uploads/safe.vtt'),
    ])
  })

  it('keeps the first surviving default track after unsafe tracks are removed', () => {
    const tracks = normalizeMediaTracks([
      track('javascript:bad'),
      track(inlineCaption),
      { ...track('/uploads/fr.vtt'), srcLang: 'fr', label: 'French' },
    ])
    expect(tracks).toEqual([
      track(inlineCaption),
      { ...track('/uploads/fr.vtt'), srcLang: 'fr', label: 'French', default: false },
    ])
  })
})
