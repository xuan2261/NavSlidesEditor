import { describe, expect, it } from 'vitest'
import { renderElement } from '../src/element-renderers.js'

describe('element-renderers safety behavior', () => {
  const base = {
    id: 'el-1',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    zIndex: 1,
  }

  it('sanitizes text element HTML', () => {
    const html = renderElement(
      { ...base, type: 'text', content: '<p onclick="x()">Hi</p><script>alert(1)</script>' },
      {},
      {}
    )
    expect(html).toContain('<p>Hi</p>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onclick=')
  })

  it('adds imported PPTX text wrapping styles only when metadata is present', () => {
    const plain = renderElement({ ...base, type: 'text', content: '<p>Normal</p>' }, {}, {})
    expect(plain).not.toContain('overflow-wrap:anywhere')

    const imported = renderElement(
      { ...base, type: 'text', content: '<p>Imported</p>', _pptxImportMeta: { textFit: 'wrap', version: 1 } },
      {},
      {}
    )
    expect(imported).toContain('overflow-wrap:anywhere')
    expect(imported).toContain('white-space:pre-wrap')
    expect(imported).toContain('word-break:normal')
  })

  it('sanitizes dangerous svg content', () => {
    const html = renderElement(
      {
        ...base,
        type: 'svg',
        content:
          '<svg><script>alert(1)</script><foreignObject></foreignObject><rect onload="x()" width="10" height="10" /></svg>',
      },
      {},
      {}
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<foreignObject')
    expect(html).not.toContain('onload=')
  })

  it('keeps html embed scripts intact', () => {
    const html = renderElement(
      { ...base, type: 'html', content: '<script>window.__trusted = true</script>' },
      {},
      {}
    )
    expect(html).toContain('src="data:text/html;charset=utf-8,')
    expect(html).not.toContain('srcdoc=')
    const encoded = html.match(/src="data:text\/html;charset=utf-8,([^"]+)"/)[1]
    expect(decodeURIComponent(encoded)).toContain('window.__trusted = true')
  })

  it('adds base URL to data URL html embeds so local assets resolve', () => {
    const html = renderElement(
      { ...base, type: 'html', content: '<img src="/uploads/local.png"><script src="/vendor/d3/dist/d3.js"></script>' },
      {},
      {}
    )
    const encoded = html.match(/src="data:text\/html;charset=utf-8,([^"]+)"/)[1]
    const decoded = decodeURIComponent(encoded)
    expect(decoded).toContain('<base href="http://localhost:3000/">')
    expect(decoded).toContain('src="/uploads/local.png"')
    expect(decoded).toContain('src="/vendor/d3/dist/d3.js"')
  })

  it('uses data-pdf-iframe for html embeds in print output', () => {
    const html = renderElement(
      { ...base, type: 'html', content: '<script>window.__trusted = true</script>' },
      {},
      { forPrint: true }
    )

    expect(html).toContain('data-pdf-iframe=')
    expect(html).not.toContain('srcdoc=')
    expect(decodeURIComponent(html.match(/data-pdf-iframe="([^"]+)"/)[1])).toContain(
      'window.__trusted = true'
    )
  })

  it('applies latex font size and color in present and print output', () => {
    const element = {
      ...base,
      type: 'latex',
      content: '\\frac{a}{b}',
      fontSize: 28,
      textColor: '#10b981',
    }

    const presentHtml = renderElement(element, {}, {})
    expect(presentHtml).toContain('font-size:calc(28px * var(--font-zoom, 1))')
    expect(presentHtml).toContain('color:#10b981')

    const printHtml = renderElement(element, {}, { forPrint: true })
    expect(printHtml).toContain('font-size:calc(28px * var(--font-zoom, 1))')
    expect(printHtml).toContain('color:#10b981')
  })

  it('renders video trim and playback rate attributes', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        src: 'https://example.com/demo.ogv',
        startTime: 5,
        endTime: 12,
        playbackRate: 1.25,
      },
      {},
      {}
    )

    expect(html).toContain('src="https://example.com/demo.ogv#t=5,12"')
    expect(html).toContain('onloadedmetadata="this.playbackRate=1.25"')
  })

  it('omits default video trim and playback rate attributes', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        src: 'https://example.com/demo.ogv',
        startTime: 0,
        endTime: 0,
        playbackRate: 1,
      },
      {},
      {}
    )

    expect(html).toContain('src="https://example.com/demo.ogv"')
    expect(html).not.toContain('#t=')
    expect(html).not.toContain('onloadedmetadata=')
  })

  it('keeps invalid video trim end time as start-only media fragment', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        src: 'https://example.com/demo.ogv',
        startTime: 10,
        endTime: 5,
      },
      {},
      {}
    )

    expect(html).toContain('src="https://example.com/demo.ogv#t=10"')
  })

  it('renders video from videoUrl property', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        videoUrl: 'https://example.com/video.mp4',
      },
      {},
      {}
    )
    expect(html).toContain('src="https://example.com/video.mp4"')
    expect(html).toContain('<video')
  })

  it('prefers videoUrl over src when both present', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        videoUrl: 'https://example.com/url-video.mp4',
        src: '/uploads/uploaded-video.mp4',
      },
      {},
      {}
    )
    expect(html).toContain('src="https://example.com/url-video.mp4"')
    expect(html).not.toContain('uploaded-video')
  })

  it('applies trim and playback rate to videoUrl videos', () => {
    const html = renderElement(
      {
        ...base,
        type: 'video',
        videoUrl: 'https://example.com/video.mp4',
        startTime: 3,
        endTime: 15,
        playbackRate: 2,
      },
      {},
      {}
    )
    expect(html).toContain('src="https://example.com/video.mp4#t=3,15"')
    expect(html).toContain('onloadedmetadata="this.playbackRate=2"')
  })

  it('renders image citation text below image', () => {
    const html = renderElement(
      {
        ...base,
        type: 'image',
        src: '/uploads/photo.jpg',
        citationText: 'Photo by John Doe',
        citationColor: '#808080',
      },
      {},
      {}
    )
    expect(html).toContain('Photo by John Doe')
    expect(html).toContain('#808080')
  })

  it('renders image citation link as clickable', () => {
    const html = renderElement(
      {
        ...base,
        type: 'image',
        src: '/uploads/photo.jpg',
        citationLink: 'https://example.com',
      },
      {},
      {}
    )
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('https://example.com')
  })

  it('omits citation div when no citation properties set', () => {
    const html = renderElement(
      {
        ...base,
        type: 'image',
        src: '/uploads/photo.jpg',
      },
      {},
      {}
    )
    expect(html).not.toContain('citation')
  })

  it('renders timeline element with SVG', () => {
    const html = renderElement(
      {
        ...base,
        type: 'timeline',
        width: 800,
        height: 400,
        startDate: '2000',
        endDate: '2025',
        tickSpacing: 'auto',
        lineColor: '#6366f1',
        textColor: '#fff',
        fontSize: 11,
        items: [],
      },
      {},
      {}
    )
    expect(html).toContain('<svg')
    expect(html).toContain('#6366f1')
  })

  it('renders timeline events', () => {
    const html = renderElement(
      {
        ...base,
        type: 'timeline',
        width: 800,
        height: 400,
        startDate: '2000',
        endDate: '2025',
        tickSpacing: 'auto',
        lineColor: '#6366f1',
        textColor: '#fff',
        fontSize: 11,
        items: [
          { id: '1', date: '2010', label: 'Launch', description: 'Product launch', side: 'top' },
        ],
      },
      {},
      {}
    )
    expect(html).toContain('Launch')
    expect(html).toContain('Product launch')
  })

  it('renders timeline events from the plan schema', () => {
    const html = renderElement(
      {
        ...base,
        type: 'timeline',
        width: 800,
        height: 400,
        timelineStart: '2000',
        timelineEnd: '2025',
        tickSpacing: 'auto',
        events: [
          { id: '1', date: '2010', title: 'Plan Launch', description: 'Plan event', side: 'top' },
        ],
      },
      {},
      {}
    )

    expect(html).toContain('Plan Launch')
    expect(html).toContain('Plan event')
  })

  it('clips source-cropped images in the shared renderer like the editor', () => {
    const html = renderElement(
      {
        ...base,
        type: 'image',
        src: '/uploads/photo.jpg',
        imageW: 260,
        imageH: 120,
        imageOffsetX: -30,
        imageOffsetY: -10,
        _pptxImportMeta: {
          sourceCrop: true,
          cropData: { left: 0.1, right: 0.1, top: 0.05, bottom: 0.05 },
        },
      },
      {},
      {}
    )
    expect(html).toContain('overflow:hidden')
    expect(html).toContain('data-pptx-crop-intent="source-crop"')
    expect(html).toContain('left:-30px')
  })

  it('validates imported fit font size before emitting shared CSS', () => {
    const html = renderElement(
      {
        ...base,
        type: 'text',
        content: '<p>Imported</p>',
        fontSize: 18,
        _pptxImportMeta: { textFit: 'wrap', version: 1, fitFontSizePx: '1);background:url(javascript:alert(1))' },
      },
      {},
      {}
    )
    expect(html).toContain('font-size:calc(18px * var(--font-zoom, 1))')
    expect(html).not.toContain('javascript:')
  })

  it('renders table cells with per-side borders', () => {
    const html = renderElement(
      {
        ...base,
        type: 'table',
        data: [['A']],
        cellStyles: {
          borders: [[{
            top: { color: '#ff0000', width: 2, style: 'dashed' },
            right: { color: '#00ff00', width: 3, style: 'solid' },
            bottom: { color: '#0000ff', width: 4, style: 'dotted' },
            left: { color: '#111111', width: 5, style: 'double' },
          }]],
        },
      },
      {},
      {}
    )

    expect(html).toContain('border-top:2px dashed #ff0000')
    expect(html).toContain('border-right:3px solid #00ff00')
    expect(html).toContain('border-bottom:4px dotted #0000ff')
    expect(html).toContain('border-left:5px double #111111')
  })

  it('renders table cell typography and row/column sizing', () => {
    const html = renderElement(
      {
        ...base,
        type: 'table',
        data: [['A', 'B']],
        colWidths: [80, 120],
        rowHeights: [40],
        cellStyles: {
          textColors: [['#112233', null]],
          bgColors: [['#ddeeff', null]],
          isBold: [[true, false]],
          fontSizes: [[24, null]],
          fontFamilies: [['Arial', null]],
          aligns: [['center', 'left']],
          vAligns: [['bottom', 'top']],
        },
      },
      {},
      {}
    )

    expect(html).toContain('<col style="width:80px"')
    expect(html).toContain('<tr style="height:40px"')
    expect(html).toContain('font-size:calc(24px * var(--font-zoom, 1))')
    expect(html).toContain('font-family:Arial')
    expect(html).toContain('background:#ddeeff')
    expect(html).toContain('color:#112233')
    expect(html).toContain('font-weight:600')
    expect(html).toContain('text-align:center')
    expect(html).toContain('vertical-align:bottom')
  })

  it('sanitizes unsafe table border CSS in shared rendering', () => {
    const html = renderElement(
      {
        ...base,
        type: 'table',
        borderColor: '#cccccc',
        data: [['A']],
        cellStyles: {
          borders: [[{
            top: {
              color: 'red;display:block',
              width: '2;position:absolute',
              style: 'solid;background:url(javascript:alert(1))',
            },
          }]],
        },
      },
      {},
      {}
    )

    expect(html).toContain('border-top:1px solid #cccccc')
    expect(html).not.toContain('display:block')
    expect(html).not.toContain('javascript:')
  })
})
