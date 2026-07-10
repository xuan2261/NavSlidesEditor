import { describe, expect, it } from 'vitest'
import { renderElement, renderSlideElements } from '../src/element-renderers.js'

describe('element-renderers safety behavior', () => {
  const base = {
    id: 'el-1',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    zIndex: 1,
  }

  it('[cap:element.audio depth:export] honors disabled player controls', () => {
    const html = renderElement(
      { ...base, type: 'audio', src: '/uploads/audio.mp3', controls: false },
      {},
      {}
    )
    expect(html).toContain('<audio')
    expect(html).not.toMatch(/<audio[^>]*\scontrols(?:\s|>)/)
  })

  it('[cap:element.text depth:export] sanitizes text element HTML and applies typography', () => {
    const html = renderElement(
      {
        ...base,
        type: 'text',
        content: '<p onclick="x()">Hi</p><script>alert(1)</script>',
        textColor: '#22c55e',
        fontFamily: 'Inter',
        fontSize: 24,
      },
      {},
      {}
    )
    expect(html).toContain('<p>Hi</p>')
    expect(html).toContain('color:#22c55e')
    expect(html).toContain('font-family:Inter')
    expect(html).toContain('font-size:calc(24px * var(--font-zoom, 1))')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onclick=')
  })

  it('adds imported PPTX text wrapping styles only when metadata is present', () => {
    const plain = renderElement({ ...base, type: 'text', content: '<p>Normal</p>' }, {}, {})
    expect(plain).not.toContain('overflow-wrap:anywhere')

    const imported = renderElement(
      {
        ...base,
        type: 'text',
        content: '<p>Imported</p>',
        _pptxImportMeta: { textFit: 'wrap', version: 1 },
      },
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

  it('[cap:element.svg tier:deep depth:export] sanitizes active svg payloads and external references', () => {
    const html = renderElement(
      {
        ...base,
        type: 'svg',
        content:
          '<svg><script>alert(1)</script><foreignObject></foreignObject><rect onclick="x()" width="10" height="10" /><use href="https://evil.example/icon.svg#x"/><image xlink:href="javascript:alert(1)"/><image src="http://evil.example/p.png"/></svg>',
      },
      {},
      {}
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('<foreignObject')
    expect(html).not.toContain('onclick=')
    expect(html).not.toContain('https://evil.example')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('http://evil.example')
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

  it('[cap:element.html depth:export] renders Mermaid html embeds with vendored runtime', () => {
    const html = renderElement(
      {
        ...base,
        type: 'html',
        embedKind: 'mermaid',
        mermaidSource: 'flowchart TD\n  A-->B',
      },
      {},
      {}
    )
    const encoded = html.match(/src="data:text\/html;charset=utf-8,([^"]+)"/)[1]
    const decoded = decodeURIComponent(encoded)

    expect(decoded).toContain('/vendor/mermaid/mermaid.min.js')
    expect(decoded).toContain('flowchart TD')
    expect(decoded).toContain('mermaid.run()')
  })

  it('[cap:element.html depth:export] preserves STEM simulation iframe attributes', () => {
    const html = renderElement(
      {
        ...base,
        type: 'html',
        embedKind: 'stem-simulation',
        provider: 'desmos',
        sourceUrl: 'https://www.desmos.com/calculator/calc123',
        content:
          '<iframe src="https://www.desmos.com/calculator/calc123" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="fullscreen" referrerpolicy="no-referrer" loading="lazy"></iframe>',
      },
      {},
      {}
    )
    const encoded = html.match(/src="data:text\/html;charset=utf-8,([^"]+)"/)[1]
    const decoded = decodeURIComponent(encoded)

    expect(decoded).toContain('https://www.desmos.com/calculator/calc123')
    expect(decoded).toContain('sandbox="allow-scripts allow-same-origin allow-forms allow-popups"')
    expect(decoded).toContain('referrerpolicy="no-referrer"')
    expect(decoded).toContain('loading="lazy"')
  })

  it('[cap:element.game depth:export] renders matching public fallback without participant data', () => {
    const html = renderElement(
      {
        ...base,
        type: 'game',
        gameType: 'matching',
        matching: {
          title: 'Matching',
          prompt: 'Match networking terms',
          pairs: [
            { promptId: 'p-http', prompt: 'HTTP', targetId: 't-protocol', target: 'Protocol' },
            { promptId: 'p-tls', prompt: 'TLS', targetId: 't-security', target: 'Security' },
          ],
        },
        matchingSubmissions: [{ playerName: 'Alice', pairs: [{ promptId: 'p-http', targetId: 't-protocol' }] }],
      },
      {},
      {}
    )

    expect(html).toContain('Match networking terms')
    expect(html).toContain('HTTP → Protocol')
    expect(html).toContain('TLS → Security')
    expect(html).not.toContain('Alice')
    expect(html).not.toContain('matchingSubmissions')
  })

  it('[cap:element.code depth:export] renders code language class and escaped source', () => {
    const html = renderElement(
      {
        ...base,
        type: 'code',
        language: 'javascript',
        content: 'if (a < b) console.log("ok")',
        fontSize: 18,
      },
      {},
      {}
    )

    expect(html).toContain('class="language-javascript"')
    expect(html).toContain('if (a &lt; b) console.log(&quot;ok&quot;)')
    expect(html).toContain('font-size:calc(18px * var(--font-zoom, 1))')
  })

  it('[cap:element.code depth:export] preserves walkthrough metadata and highlights default lines', () => {
    const html = renderElement(
      {
        ...base,
        type: 'code',
        language: 'javascript',
        content: 'const a = 1\nconst b = 2\nreturn a + b',
        walkthroughSteps: [{ label: 'Return', startLine: 2, endLine: 3 }],
        defaultStepIndex: 0,
      },
      {},
      {}
    )

    expect(html).toContain('data-code-walkthrough=')
    expect(html).toContain('data-code-line="1"')
    expect(html).toContain('data-code-line="2" data-walkthrough-active="true"')
    expect(html).toContain('data-code-line="3" data-walkthrough-active="true"')
    expect(html).toContain('class="language-javascript nohighlight"')
    expect(html).not.toContain('class="language-javascript" data-trim')
    expect(html).toContain('return a + b')
  })

  it('adds base URL to data URL html embeds so local assets resolve', () => {
    const html = renderElement(
      {
        ...base,
        type: 'html',
        content: '<img src="/uploads/local.png"><script src="/vendor/d3/dist/d3.js"></script>',
      },
      {},
      {}
    )
    const encoded = html.match(/src="data:text\/html;charset=utf-8,([^"]+)"/)[1]
    const decoded = decodeURIComponent(encoded)
    expect(decoded).toContain('<base href="http://localhost:3000/">')
    expect(decoded).toContain('src="/uploads/local.png"')
    expect(decoded).toContain('src="/vendor/d3/dist/d3.js"')
  })

  it('[cap:element.html depth:export] uses data-pdf-iframe for html embeds in print output', () => {
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

  it('[cap:element.latex depth:export] applies latex font size and color in present and print output', () => {
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

  it('[cap:element.latex depth:export] normalizes documented display math wrappers', () => {
    const html = renderElement(
      {
        ...base,
        type: 'latex',
        content: '\\[ E = mc^2 \\]',
      },
      {},
      {}
    )

    expect(html).toContain('data-math-latex="E = mc^2"')
    expect(html).not.toContain('data-math-latex="\\[')
  })

  it('[cap:element.video depth:export] renders video trim and playback rate attributes', () => {
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

  it('prefers canonical src over legacy videoUrl when both present', () => {
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
    expect(html).toContain('src="http://localhost:3000/uploads/uploaded-video.mp4"')
    expect(html).not.toContain('url-video.mp4')
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

  it('[cap:element.image depth:export] renders image citation text below image', () => {
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

  it('[cap:element.audio depth:export] renders audio source and playback flags', () => {
    const html = renderElement(
      {
        ...base,
        type: 'audio',
        src: 'https://example.com/demo.mp3',
        autoplay: true,
        loop: true,
        muted: true,
      },
      {},
      {}
    )

    expect(html).toContain('<audio')
    expect(html).toContain('src="https://example.com/demo.mp3"')
    expect(html).toContain('autoplay')
    expect(html).toContain('loop')
    expect(html).toContain('muted')
  })

  it('[cap:element.shape depth:export] renders shape fill, stroke, and label text', () => {
    const html = renderElement(
      {
        ...base,
        type: 'shape',
        shape: 'rect',
        fill: '#22c55e',
        stroke: '#0f172a',
        strokeWidth: 3,
        text: 'Status',
        textColor: '#ffffff',
        fontSize: 20,
      },
      {},
      {}
    )

    expect(html).toContain('<svg')
    expect(html).toContain('fill="#22c55e"')
    expect(html).toContain('stroke="#0f172a"')
    expect(html).toContain('stroke-width="3"')
    expect(html).toContain('font-size="20"')
    expect(html).toContain('Status')
  })

  it('[cap:element.line depth:export] renders line stroke width, dash pattern, and markers', () => {
    const html = renderElement(
      {
        ...base,
        type: 'line',
        stroke: '#f97316',
        strokeWidth: 6,
        dashArray: '8 4',
        arrowStart: 'circle',
        arrowEnd: 'arrow',
      },
      {},
      {}
    )

    expect(html).toContain('stroke="#f97316"')
    expect(html).toContain('stroke-width="6"')
    expect(html).toContain('stroke-dasharray="8 4"')
    expect(html).toContain('marker-start=')
    expect(html).toContain('marker-end=')
  })

  it('[cap:element.callout depth:export] renders callout number, colors, and font size', () => {
    const html = renderElement(
      {
        ...base,
        type: 'callout',
        calloutNumber: 7,
        calloutColor: '#2563eb',
        calloutTextColor: '#f8fafc',
        fontSize: 22,
      },
      {},
      {}
    )

    expect(html).toContain('background:#2563eb')
    expect(html).toContain('color:#f8fafc')
    expect(html).toContain('font-size:calc(22px * var(--font-zoom, 1))')
    expect(html).toContain('>7</div>')
  })

  it('[cap:element.icon depth:export] renders icon stroke color and width', () => {
    const html = renderElement(
      {
        ...base,
        type: 'icon',
        iconName: 'Star',
        iconColor: '#a855f7',
        iconStrokeWidth: 3.5,
      },
      {},
      {}
    )

    expect(html).toContain('<svg')
    expect(html).toContain('stroke="#a855f7"')
    expect(html).toContain('stroke-width="3.5"')
  })

  it('[cap:element.qrcode depth:export] renders print QR canvas config', () => {
    const html = renderElement(
      {
        ...base,
        type: 'qrcode',
        qrData: 'https://example.com/share',
        qrColor: '#111827',
        qrBgColor: '#f9fafb',
        qrErrorLevel: 'H',
      },
      {},
      { forPrint: true }
    )
    const config = JSON.parse(html.match(/data-qr-config='([^']+)'/)[1])

    expect(html).toContain('data-qr-config=')
    expect(config).toEqual({
      data: 'https://example.com/share',
      fg: '#111827',
      bg: '#f9fafb',
      err: 'H',
    })
  })

  it('[cap:element.drawing depth:export] renders drawing paths with stroke styling', () => {
    const html = renderElement(
      {
        ...base,
        type: 'drawing',
        strokeColor: '#ffffff',
        strokeWidth: 4,
        paths: [{ d: 'M 0 0 L 20 20', opacity: 0.75 }],
      },
      {},
      {}
    )

    expect(html).toContain('d="M 0 0 L 20 20"')
    expect(html).toContain('stroke="#ffffff"')
    expect(html).toContain('stroke-width="4"')
    expect(html).toContain('opacity="0.75"')
  })

  it('[cap:element.drawing tier:deep depth:export] lets per-path stroke override element stroke defaults', () => {
    const html = renderElement(
      {
        ...base,
        type: 'drawing',
        strokeColor: '#ffffff',
        strokeWidth: 4,
        paths: [{ d: 'M 0 0 L 20 20', stroke: '#111111', strokeWidth: 2 }],
      },
      {},
      {}
    )

    expect(html).toContain('stroke="#111111"')
    expect(html).toContain('stroke-width="2"')
    expect(html).not.toContain('stroke="#ffffff"')
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

  it('[cap:element.timeline tier:deep depth:export] renders timeline events from the plan schema', () => {
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

  it('[cap:element.timeline tier:deep depth:export] consumes connectorLength and connectorOffset fields', () => {
    const withLength = renderElement(
      {
        ...base,
        type: 'timeline',
        width: 800,
        height: 400,
        timelineStart: '2000',
        timelineEnd: '2025',
        events: [{ id: '1', date: '2010', title: 'Top', side: 'top', connectorLength: 40 }],
      },
      {},
      {}
    )
    const withOffset = renderElement(
      {
        ...base,
        type: 'timeline',
        width: 800,
        height: 400,
        timelineStart: '2000',
        timelineEnd: '2025',
        events: [{ id: '1', date: '2010', title: 'Top', side: 'top', connectorOffset: 40 }],
      },
      {},
      {}
    )

    expect(withLength).toContain('y1="132"')
    expect(withOffset).toContain('y1="132"')
  })

  it('[cap:element.game depth:export] renders a static public fallback for game elements', () => {
    const html = renderElement(
      {
        ...base,
        type: 'game',
        gameType: 'hot-potato',
        title: 'Fallback title',
        'hot-potato': {
          title: 'Class Quiz',
          questions: [{ question: 'Hidden?', correctIndex: 0, answer: 'Secret', points: 500 }],
        },
      },
      {},
      {}
    )

    expect(html).toContain('data-game-fallback="true"')
    expect(html).toContain('data-game-type="hot-potato"')
    expect(html).toContain('Class Quiz')
    expect(html).toContain('Interactive game')
  })

  it('[cap:element.game tier:deep depth:export] does not leak raw game config or live-only controls', () => {
    const html = renderElement(
      {
        ...base,
        type: 'game',
        gameType: 'jeopardy',
        title: 'Public Jeopardy',
        presenterToken: 'presenter-secret-token',
        adminToken: 'admin-secret-token',
        sessionId: 'session-secret-id',
        roomCode: 'ROOM42',
        scoring: { mode: 'private-scoring' },
        jeopardy: {
          title: 'Public Board',
          teams: [{ id: 'team-secret', name: 'Private Team', score: 1200 }],
          questions: {
            '0-100': {
              question: 'Question text',
              correctIndex: 2,
              answer: 'Private Answer',
              points: 100,
            },
          },
        },
      },
      {},
      {}
    )

    expect(html).toContain('Public Board')
    expect(html).toContain('data-game-type="jeopardy"')
    expect(html).not.toContain('presenter-secret-token')
    expect(html).not.toContain('admin-secret-token')
    expect(html).not.toContain('session-secret-id')
    expect(html).not.toContain('ROOM42')
    expect(html).not.toContain('private-scoring')
    expect(html).not.toContain('Private Team')
    expect(html).not.toContain('team-secret')
    expect(html).not.toContain('correctIndex')
    expect(html).not.toContain('Private Answer')
    expect(html).not.toContain('Question text')
    expect(html).not.toContain('player')
    expect(html).not.toContain('admin')
  })

  it('[cap:element.game depth:export] exports poll prompt and options without raw vote data', () => {
    const html = renderElement(
      {
        ...base,
        type: 'game',
        gameType: 'poll',
        poll: {
          title: 'Exit Ticket',
          prompt: 'Which topic needs review?',
          options: [
            { id: 'a', text: 'Vectors', votes: 987 },
            { id: 'b', text: 'Matrices', votes: 654 },
          ],
        },
        pollVotes: { 'player-secret': 'a' },
        rawResponses: [{ playerName: 'Alice', optionId: 'a' }],
      },
      {},
      {}
    )

    expect(html).toContain('data-game-type="poll"')
    expect(html).toContain('Exit Ticket')
    expect(html).toContain('Which topic needs review?')
    expect(html).toContain('Vectors')
    expect(html).toContain('Matrices')
    expect(html).not.toContain('player-secret')
    expect(html).not.toContain('Alice')
    expect(html).not.toContain('987')
    expect(html).not.toContain('654')
  })

  it('[cap:element.game depth:export] exports word cloud prompt without raw submissions or aggregate text', () => {
    const html = renderElement(
      {
        ...base,
        type: 'game',
        gameType: 'word-cloud',
        'word-cloud': {
          title: 'Warmup Cloud',
          prompt: 'One word about entropy',
        },
        wordCloudCounts: { 'entropy-secret': 987 },
        wordCloudRawSubmissions: [{ playerName: 'Alice', text: 'entropy-secret' }],
      },
      {},
      {}
    )

    expect(html).toContain('data-game-type="word-cloud"')
    expect(html).toContain('Warmup Cloud')
    expect(html).toContain('One word about entropy')
    expect(html).not.toContain('Alice')
    expect(html).not.toContain('entropy-secret')
    expect(html).not.toContain('987')
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
        _pptxImportMeta: {
          textFit: 'wrap',
          version: 1,
          fitFontSizePx: '1);background:url(javascript:alert(1))',
        },
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
          borders: [
            [
              {
                top: { color: '#ff0000', width: 2, style: 'dashed' },
                right: { color: '#00ff00', width: 3, style: 'solid' },
                bottom: { color: '#0000ff', width: 4, style: 'dotted' },
                left: { color: '#111111', width: 5, style: 'double' },
              },
            ],
          ],
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

  it('[cap:element.table depth:export] renders table cell typography and row/column sizing', () => {
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
          borders: [
            [
              {
                top: {
                  color: 'red;display:block',
                  width: '2;position:absolute',
                  style: 'solid;background:url(javascript:alert(1))',
                },
              },
            ],
          ],
        },
      },
      {},
      {}
    )

    expect(html).toContain('border-top:1px solid #cccccc')
    expect(html).not.toContain('display:block')
    expect(html).not.toContain('javascript:')
  })

  it('[cap:element.chart tier:deep depth:export] renders a stacked bar chart with both axes stacked (iframe + print)', () => {
    const element = {
      ...base,
      type: 'chart',
      chartType: 'bar',
      stacked: true,
      chartData: {
        labels: ['Q1', 'Q2'],
        datasets: [{ label: 'S1', data: [10, 20], color: '#6366f1' }],
      },
    }

    // iframe path builds scales as a raw template literal (unquoted keys).
    const iframe = renderElement(element, {}, {})
    expect(iframe).toContain('stacked:true')

    // print path JSON-stringifies the options object (quoted keys).
    const print = renderElement(element, {}, { forPrint: true })
    expect(print).toMatch(/"x":\{[^}]*"stacked":true/)
    expect(print).toMatch(/"y":\{[^}]*"stacked":true/)
  })

  it('renders an area chart as a filled line (iframe + print)', () => {
    const element = {
      ...base,
      type: 'chart',
      chartType: 'line',
      areaFill: true,
      chartData: {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [{ label: 'S1', data: [3, 7, 5], color: '#22c55e' }],
      },
    }

    const iframe = renderElement(element, {}, {})
    expect(iframe).toContain("type:'line'")

    // print path JSON-stringifies datasets with clean quotes.
    const print = renderElement(element, {}, { forPrint: true })
    expect(print).toContain('"fill":true')
  })

  it('does not stack a plain bar chart or fill a plain line chart', () => {
    const bar = renderElement(
      {
        ...base,
        type: 'chart',
        chartType: 'bar',
        chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1], color: '#6366f1' }] },
      },
      {},
      { forPrint: true }
    )
    expect(bar).not.toContain('"stacked":true')

    const line = renderElement(
      {
        ...base,
        type: 'chart',
        chartType: 'line',
        chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1], color: '#6366f1' }] },
      },
      {},
      { forPrint: true }
    )
    expect(line).toContain('"fill":false')
  })

  it('[cap:element.chart tier:deep depth:export] renders radial chart scales for iframe and print output', () => {
    const radar = {
      ...base,
      type: 'chart',
      chartType: 'radar',
      chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1], color: '#6366f1' }] },
    }
    const polar = { ...radar, chartType: 'polarArea' }

    const radarIframe = renderElement(radar, {}, {})
    expect(radarIframe).toContain('scales:{r:')
    expect(radarIframe).not.toContain('scales:{x:')

    const radarPrint = renderElement(radar, {}, { forPrint: true })
    expect(radarPrint).toContain('"r":{')
    expect(radarPrint).not.toContain('"x":{')

    const polarIframe = renderElement(polar, {}, {})
    expect(polarIframe).toContain('scales:{}')
    expect(polarIframe).not.toContain('scales:{x:')

    const polarPrint = renderElement(polar, {}, { forPrint: true })
    expect(polarPrint).toContain('"scales":{}')
    expect(polarPrint).not.toContain('"x":{')
  })

  it('omits hidden elements from shared HTML export output', () => {
    const html = renderSlideElements({
      elements: [
        { ...base, id: 'visible-text', type: 'text', content: '<p>Visible marker</p>' },
        { ...base, id: 'hidden-text', type: 'text', hidden: true, content: '<p>Hidden marker</p>' },
      ],
    })

    expect(html).toContain('Visible marker')
    expect(html).not.toContain('Hidden marker')
    expect(html).not.toContain('hidden-text')
  })
})
