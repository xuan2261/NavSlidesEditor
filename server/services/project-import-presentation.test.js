// @vitest-environment node
import { describe, expect, it } from 'vitest'
import presentationModule from './project-import-presentation'

const { collectMediaUrls, rewritePresentationMedia } = presentationModule

function mediaDeck() {
  return {
    slides: [{
      id: 's1', background: { type: 'video', video: '/uploads/bg.mp4#t=2' },
      elements: [{ id: 'g1', type: 'group', elements: [
        { id: 'e1', type: 'video', src: '/uploads/video.mp4', videoUrl: '/uploads/alternate.mp4',
          poster: '/uploads/poster.png', tracks: [{ src: '/uploads/subtitle.vtt' }] },
        { id: 't1', type: 'text', content: 'Do not rewrite /uploads/poster.png', url: '/uploads/poster.png' },
      ] }],
      children: [{ id: 's2', background: { type: 'image', image: '/uploads/child.png' }, elements: [] }],
    }],
    layoutMasters: [{ id: 'm1', background: { type: 'image', src: '/uploads/master.png' },
      fixedElements: [{ id: 'me1', type: 'image', src: 'https://remote.test/image.png' }] }],
  }
}

describe('shared project media traversal', () => {
  it('inventories every media field but not text or navigation links', () => {
    expect(new Set(collectMediaUrls(mediaDeck()))).toEqual(new Set([
      '/uploads/bg.mp4#t=2', '/uploads/video.mp4', '/uploads/alternate.mp4',
      '/uploads/poster.png', '/uploads/subtitle.vtt', '/uploads/child.png',
      '/uploads/master.png', 'https://remote.test/image.png',
    ]))
  })

  it('rewrites a cloned canonical projection with one map without changing text or media shape', () => {
    const input = mediaDeck()
    const map = Object.fromEntries(collectMediaUrls(input).map((url, index) => [url, `/uploads/destination-${index}${url.match(/[?#].*$/u)?.[0] || ''}`]))
    const output = rewritePresentationMedia(input, map)
    expect(collectMediaUrls(output)).toEqual(collectMediaUrls(input).map((url) => map[url]))
    expect(output.slides[0].elements[0].elements[1]).toEqual(input.slides[0].elements[0].elements[1])
    expect(output.layoutMasters[0].background).toHaveProperty('src')
    expect(input.slides[0].elements[0].elements[0].src).toBe('/uploads/video.mp4')
  })

  it('preserves query and fragment suffixes when mapping a local base URL', () => {
    const input = { slides: [{ elements: [{ src: '/uploads/a.mp4?x=1#t=2' }] }] }
    expect(rewritePresentationMedia(input, { '/uploads/a.mp4': '/uploads/b.mp4' })
      .slides[0].elements[0].src).toBe('/uploads/b.mp4?x=1#t=2')
  })

  it('rewrites layout media patches while leaving placeholder identity intact', () => {
    const input = { slides: [{ elements: [], layoutOverrides: {
      elementPatches: { e1: { src: '/uploads/a.png' } }, placeholderBindings: { photo: 'e1' },
    } }] }
    const output = rewritePresentationMedia(input, { '/uploads/a.png': '/uploads/b.png' })
    expect(output.slides[0].layoutOverrides.elementPatches.e1.src).toBe('/uploads/b.png')
    expect(output.slides[0].layoutOverrides.placeholderBindings).toEqual({ photo: 'e1' })
  })

  it('includes approved root background and fixed-element journal snapshots without arbitrary URL rewriting', () => {
    const input = { slides: [], background: { type: 'image', src: '/uploads/root.png' },
      fixedElements: [{ id: 'root-fixed', type: 'image', src: '/uploads/fixed.png' }],
      title: '/uploads/root.png', sourceUrl: '/uploads/root.png' }
    expect(collectMediaUrls(input)).toEqual(['/uploads/root.png', '/uploads/fixed.png'])
    const result = rewritePresentationMedia(input, { '/uploads/root.png': '/uploads/rebound.png', '/uploads/fixed.png': '/uploads/rebound-fixed.png' })
    expect(collectMediaUrls(result)).toEqual(['/uploads/rebound.png', '/uploads/rebound-fixed.png'])
    expect(result.title).toBe(input.title)
    expect(result.sourceUrl).toBe(input.sourceUrl)
  })
})
