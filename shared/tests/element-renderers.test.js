import { afterEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { renderElement, renderSlideElements } from '../src/element-renderers.js'

const documents = []
afterEach(() => {
  for (const dom of documents.splice(0)) dom.window.close()
})
function openDocument(html, options = {}) {
  const dom = new JSDOM(html, options)
  documents.push(dom)
  return dom
}
const localDependencies = {
  network: false,
  offlineCapable: true,
  resources: [],
  dynamicResources: [],
}
const assetBaseUrl = 'https://slides.example.test/decks/lesson'

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

  it.each([
    ['present', false, localDependencies],
    ['print', true, localDependencies],
    ['undeclared present', false, undefined],
    ['undeclared print', true, undefined],
  ])(
    '[cap:element.html depth:export] isolates authored code and preserves local UTF-8 behavior in %s output',
    (_label, forPrint, htmlDependencies) => {
      const content =
        '</iframe><button>Count</button><script>window.marker="child";document.querySelector("button").textContent=`Local ✓ — tiếng Việt & "quotes"`</script>'
      const outer = openDocument(
        renderElement({ ...base, type: 'html', content, htmlDependencies }, {}, { forPrint }),
        { runScripts: 'dangerously' }
      )
      const frame = outer.window.document.querySelector('iframe')
      expect(frame.getAttribute('sandbox').split(/\s+/)).toEqual(['allow-scripts'])
      expect(outer.window.marker).toBeUndefined()
      expect(outer.window.document.querySelector('button, script')).toBeNull()
      const wrappedContent = forPrint
        ? decodeURIComponent(frame.getAttribute('data-pdf-iframe'))
        : frame.getAttribute('srcdoc')
      const wrapper = openDocument(wrappedContent, { runScripts: 'dangerously' })
      expect(wrapper.window.marker).toBeUndefined()
      expect(wrapper.window.document.querySelector('button, script')).toBeNull()
      const childFrame = wrapper.window.document.querySelector('iframe')
      expect(childFrame.getAttribute('sandbox').split(/\s+/)).toEqual(['allow-scripts'])
      if (htmlDependencies) {
        expect(JSON.parse(frame.getAttribute('data-html-dependencies'))).toEqual(htmlDependencies)
        expect(JSON.parse(childFrame.getAttribute('data-html-dependencies'))).toEqual(
          htmlDependencies
        )
      } else {
        expect(frame.hasAttribute('data-html-dependencies')).toBe(false)
        expect(childFrame.hasAttribute('data-html-dependencies')).toBe(false)
      }
      const child = openDocument(childFrame.getAttribute('srcdoc'), { runScripts: 'dangerously' })
      expect(child.window.marker).toBe('child')
      expect(child.window.document.querySelector('button').textContent).toBe(
        'Local ✓ — tiếng Việt & "quotes"'
      )
      const policy = child.window.document.querySelector(
        'meta[http-equiv="Content-Security-Policy"]'
      ).content
      const directives = new Map(
        policy
          .split(';')
          .filter(Boolean)
          .map((directive) => {
            const [name, ...sources] = directive.trim().split(/\s+/)
            return [name, sources]
          })
      )
      expect(directives.get('connect-src')).toEqual(["'none'"])
      expect(directives.get('script-src')).toEqual(["'unsafe-inline'"])
    }
  )

  it('[cap:element.html depth:export] declares the vendored Mermaid runtime and treats author source as text', () => {
    const source =
      'flowchart TD\n  A["</pre></iframe><script>window.authorExecuted=true</script> & ✓"]-->B'
    const outer = openDocument(
      renderElement(
        { ...base, type: 'html', embedKind: 'mermaid', mermaidSource: source },
        {},
        { baseUrl: assetBaseUrl }
      ),
      { runScripts: 'dangerously' }
    )
    const frame = outer.window.document.querySelector('iframe')
    const runtimeUrl = new URL('/vendor/mermaid/mermaid.min.js', assetBaseUrl).href
    expect(frame.getAttribute('sandbox').split(/\s+/)).toEqual(['allow-scripts'])
    expect(outer.window.authorExecuted).toBeUndefined()
    expect(outer.window.document.querySelector('script, pre')).toBeNull()
    expect(JSON.parse(frame.getAttribute('data-html-dependencies'))).toEqual({
      network: true,
      offlineCapable: true,
      resources: [{ url: runtimeUrl, kind: 'script' }],
      dynamicResources: [],
    })
    const child = openDocument(frame.getAttribute('srcdoc'))
    expect(child.window.authorExecuted).toBeUndefined()
    expect(child.window.document.querySelector('.mermaid').textContent).toBe(source)
    expect(
      [...child.window.document.querySelectorAll('script[src]')].map((script) => script.src)
    ).toEqual([runtimeUrl])
  })

  it('[cap:element.html depth:export] preserves authored STEM iframe settings without granting parent origin access', () => {
    const outer = openDocument(
      renderElement(
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
    )
    const frame = outer.window.document.querySelector('iframe')
    expect(frame.getAttribute('sandbox').split(/\s+/)).toEqual(['allow-scripts'])
    const wrapper = openDocument(frame.getAttribute('srcdoc'))
    const child = openDocument(
      wrapper.window.document.querySelector('iframe').getAttribute('srcdoc')
    )
    const simulation = child.window.document.querySelector('iframe')
    expect(simulation.src).toBe('https://www.desmos.com/calculator/calc123')
    expect(simulation.getAttribute('sandbox').split(/\s+/)).toEqual([
      'allow-scripts',
      'allow-same-origin',
      'allow-forms',
      'allow-popups',
    ])
    expect(simulation.getAttribute('allow')).toBe('fullscreen')
    expect(simulation.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(simulation.getAttribute('loading')).toBe('lazy')
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
        matchingSubmissions: [
          { playerName: 'Alice', pairs: [{ promptId: 'p-http', targetId: 't-protocol' }] },
        ],
      },
      {},
      {}
    )

    const fallback = openDocument(html).window.document.querySelector('[data-ns-game-static]')
    expect(fallback.textContent).toContain('Match networking terms')
    const rows = [...fallback.querySelectorAll('li')].map((row) => row.textContent)
    expect(rows).toEqual(expect.arrayContaining(['HTTP', 'TLS', 'Protocol', 'Security']))
    expect(rows.some((row) => row.includes('HTTP') && row.includes('Protocol'))).toBe(false)
    expect(rows.some((row) => row.includes('TLS') && row.includes('Security'))).toBe(false)
    expect(html).not.toContain('Alice')
    expect(html).not.toContain('matchingSubmissions')
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

  it('[cap:element.qrcode depth:export] preserves punctuated QR text without granting root markup authority', () => {
    const data = `Teacher's &quot; lesson '</canvas><script data-navslides-runtime="local">window.rootEscape=true</script><iframe data-ns-generated-frame="true"></iframe>`
    const dom = openDocument(
      renderElement(
        {
          ...base,
          id: 'qr"><iframe data-ns-generated-frame=true></iframe>',
          type: 'qrcode',
          qrData: data,
        },
        {},
        { forPrint: true }
      )
    )
    const document = dom.window.document
    expect(
      JSON.parse(document.querySelector('canvas[data-qr-config]').getAttribute('data-qr-config'))
        .data
    ).toBe(data)
    expect(
      document.querySelector('script,iframe,[data-navslides-runtime],[data-ns-generated-frame]') ===
        null
    ).toBe(true)
  })

  it.each([
    { type: 'text', content: '<p>Contained</p>', fontFamily: 'FIELD' },
    { type: 'shape', text: 'Contained', fontFamily: 'FIELD', fill: 'FIELD', stroke: 'FIELD' },
    { type: 'line', x1: 'FIELD', stroke: 'FIELD', strokeWidth: 'FIELD' },
    { type: 'icon', iconColor: 'FIELD', iconStrokeWidth: 'FIELD' },
    {
      type: 'drawing',
      width: 'FIELD',
      paths: [{ d: 'M0 0L20 20', opacity: 'FIELD', strokeWidth: 'FIELD' }],
    },
  ])(
    'keeps authored $type attribute values from manufacturing root execution authority',
    (fields) => {
      const payload = `\"><script data-navslides-runtime="local">window.rootEscaped=1</script><iframe data-ns-generated-frame="true"></iframe><span onerror="window.rootEscaped=1`
      const element = JSON.parse(
        JSON.stringify({ ...base, ...fields }).replaceAll(
          'FIELD',
          JSON.stringify(payload).slice(1, -1)
        )
      )
      const { document } = openDocument(renderElement(element, {}, {})).window
      expect(
        document.querySelector(
          'script,iframe,[data-navslides-runtime],[data-ns-generated-frame],[onerror]'
        )
      ).toBeNull()
    }
  )

  it('keeps QR tag-like data from becoming a script or compiler source in its generated document', () => {
    const qrData = `Teacher's </script><script type="text/tikz" data-navslides-runtime="local">forged</script><img onerror="window.rootEscaped=1"> &quot;`
    const { document } = openDocument(
      renderElement({ ...base, type: 'qrcode', qrData }, {}, {})
    ).window
    const frameDocument = openDocument(document.querySelector('iframe').getAttribute('srcdoc'))
      .window.document
    expect(frameDocument.querySelector('canvas#c')).not.toBeNull()
    expect(
      frameDocument.querySelector('script[type="text/tikz"],[data-navslides-runtime],[onerror]')
    ).toBeNull()
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

  it('renders malformed persisted table data without crashing', () => {
    expect(() =>
      renderElement(
        {
          ...base,
          type: 'table',
          data: [{ invalid: true }, [{ value: 'cell' }]],
          mergedCells: [null, { row: 0, col: 0, rowSpan: 'bad' }],
        },
        {},
        {}
      )
    ).not.toThrow()
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

  it('renders normalized actions as labelled safe activation surfaces and leaves invalid actions inert', () => {
    const actionElement = {
      ...base,
      type: 'shape',
      action: { kind: 'slide', slideId: 'vertical-child', label: 'Open detail', hotspot: true },
    }
    const html = renderElement(actionElement, {}, {})
    expect(html).toContain('data-ns-action=')
    expect(html).toContain('aria-label="Open detail"')
    expect(html).toContain('ns-element-hotspot')
    expect(
      renderElement(
        { ...actionElement, action: { kind: 'url', url: 'javascript:alert(1)' } },
        {},
        {}
      )
    ).not.toContain('data-ns-action=')
    expect(renderElement(actionElement, {}, { forPrint: true })).not.toContain('data-ns-action=')
  })
})
