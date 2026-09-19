export const BASELINE_REVEAL_VERSION = '6.0.2'

const elementTypes = [
  'text',
  'image',
  'shape',
  'code',
  'latex',
  'html',
  'markdown',
  'chart',
  'video',
  'audio',
  'table',
  'icon',
  'callout',
  'qrcode',
  'drawing',
  'line',
  'svg',
  'timeline',
  'game',
]

export const CONTRACT_ELEMENT_TYPES = Object.freeze(elementTypes)

function baseElement(type, index) {
  return {
    id: `contract-${type}-${String(index + 1).padStart(2, '0')}`,
    type,
    x: 20 + (index % 5) * 170,
    y: 20 + Math.floor(index / 5) * 125,
    width: type === 'line' ? 140 : 150,
    height: type === 'audio' ? 48 : 100,
    zIndex: index + 1,
  }
}

function elementPayload(type) {
  const payloads = {
    text: { content: '<p><a href="https://example.com">Contract text</a></p>' },
    image: { src: '/uploads/contract.png', alt: 'Contract image' },
    shape: { shape: 'rect', fill: '#336699', text: 'Shape' },
    code: { content: 'const fixture = true', language: 'javascript' },
    latex: { content: 'x^2 + y^2' },
    html: { content: '<div>Trusted contract HTML</div>' },
    markdown: { content: '## Contract markdown' },
    chart: {
      chartType: 'bar',
      chartData: { labels: ['A'], datasets: [{ label: 'S', data: [1] }] },
    },
    video: { src: '/uploads/contract.mp4', controls: true },
    audio: { src: '/uploads/contract.mp3', controls: true },
    table: { data: [['Header'], ['Value']], headerRow: true },
    icon: { iconName: 'Star', iconColor: '#ffffff' },
    callout: { calloutNumber: 1, calloutColor: '#ef4444' },
    qrcode: { qrData: 'https://example.com' },
    drawing: { paths: [] },
    line: { x1: 0, y1: 50, x2: 140, y2: 50, stroke: '#ffffff', arrowEnd: 'arrow' },
    svg: { content: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>' },
    timeline: { timelineStart: '2020', timelineEnd: '2026', events: [] },
    game: { gameType: 'poll', poll: { prompt: 'Contract?', options: [] } },
  }
  return payloads[type]
}

export function buildAllElementTypes() {
  return elementTypes.map((type, index) => ({
    ...baseElement(type, index),
    ...elementPayload(type),
  }))
}

export function buildEditorContractPresentation() {
  const elements = buildAllElementTypes()
  elements[0].fragment = true
  elements[0].fragmentIndex = 0
  elements[1].groupId = 'contract-group'
  elements[2].groupId = 'contract-group'
  elements[2].locked = true
  const image = elements.find((element) => element.type === 'image')
  image.longDescription = 'Long-form description for the contract image.'
  image.citation = { text: 'Contract source', url: 'https://example.com/source' }
  const shape = elements.find((element) => element.type === 'shape')
  shape.action = { kind: 'next', label: 'Continue', hotspot: true }
  const video = elements.find((element) => element.type === 'video')
  video.tracks = [{ kind: 'captions', src: '/uploads/contract-captions.vtt', srcLang: 'en', label: 'English', default: true }]
  video.transcript = 'Contract video transcript'
  return {
    id: 'contract-presentation-0001',
    title: 'Controls Elements Reveal Contract',
    theme: 'dracula',
    codeTheme: 'monokai',
    resolution: { width: 960, height: 540 },
    presenterTools: { slideMenu: true, chalkboard: true, themeToggle: true, fontZoom: true },
    fixtureReceipt: { revealVersion: BASELINE_REVEAL_VERSION },
    layoutMasters: [{
      id: 'contract-layout',
      name: 'Contract Layout',
      fixedElements: [{
        id: 'contract-master-band',
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        width: 960,
        height: 36,
        zIndex: 0,
        fill: '#1f2937',
        locked: true,
      }],
      placeholders: [],
      safeArea: { x: 48, y: 32, width: 864, height: 476 },
    }],
    slides: [
      {
        id: 'contract-slide-parent',
        layoutId: 'contract-layout',
        speakerNotes: 'Parent contract notes',
        elements,
        children: [
          {
            id: 'contract-slide-child',
            speakerNotes: 'Child contract notes',
            elements: [
              {
                ...baseElement('image', 0),
                id: 'contract-child-image',
                src: '/uploads/child.png',
                alt: 'Child image',
              },
              {
                ...baseElement('video', 1),
                id: 'contract-child-video',
                src: '/uploads/child.mp4',
                controls: true,
                tracks: [{ kind: 'captions', src: '/uploads/child-captions.vtt', srcLang: 'en', label: 'English', default: true }],
                transcript: 'Child video transcript',
              },
              {
                ...baseElement('line', 2),
                id: 'contract-child-line',
                x1: 0,
                y1: 50,
                x2: 140,
                y2: 50,
                connections: {
                  start: { targetId: 'contract-child-image', anchor: 'e' },
                },
              },
            ],
          },
        ],
      },
      {
        id: 'contract-legacy-slide',
        elements: [
          {
            id: 'legacy-text',
            type: 'text',
            x: 20,
            y: 20,
            width: 300,
            height: 80,
            content: '<p>Legacy</p>',
          },
        ],
      },
    ],
  }
}

// Normative generated-HTML fixtures cover the legacy reveal surface; callers may
// mutate the returned presentation without changing the stable baseline seed.
export function buildGeneratedHtmlContractFixtures() {
  const base = buildEditorContractPresentation()
  return Object.freeze({
    horizontal: base,
    vertical: base.slides[0].children[0],
    fragments: base.slides[0].elements.filter(({ fragment }) => fragment),
    notes: { parent: base.slides[0].speakerNotes, child: base.slides[0].children[0].speakerNotes },
    highlight: { codeTheme: base.codeTheme, code: base.slides[0].elements.find(({ type }) => type === 'code') },
    themes: { theme: base.theme, codeTheme: base.codeTheme },
    presenterTools: base.presenterTools,
    iframePreview: { preview: true, presentationId: base.id },
    optionalPlugins: Object.freeze(['menu', 'chalkboard', 'custom-controls']),
    receipt: base.fixtureReceipt,
  })
}
