import { ELEMENT_DEFAULTS } from '../../../client/src/data/element-defaults.js'
import { videoSource, audioSource } from './fixtures/media-sources.js'
import { gameFixture } from './release-game-fixtures.js'

export const illustration =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#2563eb"/><circle cx="60" cy="40" r="20" fill="#facc15"/></svg>'
  ).toString('base64')
export const counterHtml = `<style>button{font:24px sans-serif}output{font:24px sans-serif}</style><button id="increment">Increment lesson</button><output id="count">0</output><output id="isolation"></output><script>let count=0;document.querySelector('#increment').onclick=()=>document.querySelector('#count').textContent=++count;let blocked=[];try{parent.document.body.dataset.attacked='yes'}catch(e){blocked.push('parent')}try{parent.localStorage.setItem('release-attack','yes')}catch(e){blocked.push('storage')}document.querySelector('#isolation').textContent=blocked.join(',')</script>`
const authored = {
  text: {
    content:
      '<h2>Authored heading</h2><ul><li><strong>Bold term</strong> <em>Italic term</em> <a href="https://example.com/lesson">Lesson link</a></li></ul>',
    fontSize: 24,
    fontFamily: 'Georgia',
    lineHeight: 1.7,
    textColor: '#111111',
  },
  image: {
    src: illustration,
    alt: 'Authored diagram',
    longDescription: 'Authored accessible description',
    objectFit: 'contain',
    borderWidth: 3,
    borderColor: '#16a34a',
    flipH: true,
    filterSaturate: 70,
    citationText: 'Authored citation',
    citationLink: 'https://example.com/citation',
  },
  shape: {
    shape: 'rect',
    text: 'Authored shape label',
    textHtml: '<strong>Authored shape label</strong>',
    fill: '#16a34a',
    stroke: '#111111',
    strokeWidth: 3,
    textColor: '#111111',
    fontSize: 24,
    rotation: 12,
    opacity: 0.8,
  },
  code: {
    content: 'const lesson = 19;\nconsole.log(lesson);',
    language: 'javascript',
    fontSize: 20,
    borderRadius: 12,
    walkthroughSteps: [{ label: 'Authored first line', startLine: 1, endLine: 1 }],
    defaultStepIndex: 0,
  },
  latex: { content: 'E=mc^2', fontSize: 24, textColor: '#111111' },
  html: {
    content: counterHtml,
    htmlDependencies: { network: false, offlineCapable: true, resources: [], dynamicResources: [] },
  },
  markdown: {
    content:
      '# Authored markdown\n\n- **Bold term** and *Italic term*\n\n`lesson()` [Lesson link](https://example.com/lesson)',
    fontSize: 22,
    textColor: '#111111',
  },
  chart: {
    chartType: 'bar',
    chartData: {
      labels: ['Alpha', 'Beta'],
      datasets: [{ label: 'Authored series', data: [5, 12], color: '#2563eb' }],
    },
    stacked: true,
    legendPosition: 'top',
    axisTitles: { category: 'Authored category', value: 'Authored quantity' },
  },
  video: {
    src: videoSource,
    poster: illustration,
    muted: true,
    loop: true,
    playbackRate: 1.5,
    transcript: 'Authored video transcript',
    audioDescription: 'Authored video description',
    tracks: [
      {
        kind: 'captions',
        src:
          'data:text/vtt;base64,' +
          Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nAuthored caption').toString('base64'),
        srcLang: 'en',
        label: 'English',
        default: true,
      },
    ],
  },
  audio: {
    src: audioSource(),
    transcript: 'Authored audio transcript',
    audioDescription: 'Authored audio description',
    muted: true,
    loop: true,
  },
  table: {
    data: [
      ['Authored heading', 'Merged', ''],
      ['Authored cell', '19', '20'],
    ],
    mergedCells: [{ row: 0, col: 1, rowSpan: 1, colSpan: 2 }],
    colWidths: [220, 140, 140],
    rowHeights: [70, 80],
    textColor: '#111111',
    headerBgColor: '#dbeafe',
    borderColor: '#111111',
    borderWidth: 2,
    cellPadding: 12,
  },
  icon: { iconName: 'Star', iconColor: '#2563eb', iconStrokeWidth: 3 },
  callout: {
    calloutNumber: 19,
    calloutColor: '#2563eb',
    calloutTextColor: '#ffffff',
    fontSize: 28,
    width: 90,
    height: 90,
  },
  qrcode: {
    qrData: 'https://example.com/release-19',
    qrColor: '#112233',
    qrBgColor: '#ffffff',
    qrErrorLevel: 'H',
    width: 300,
    height: 300,
  },
  drawing: { paths: [{ d: 'M 30 40 L 220 40 L 220 160' }], strokeColor: '#2563eb', strokeWidth: 8 },
  line: {
    x1: 0,
    y1: 30,
    x2: 300,
    y2: 160,
    cx: 160,
    cy: 0,
    stroke: '#2563eb',
    strokeWidth: 6,
    arrowStart: 'circle',
    arrowEnd: 'arrow',
    dashArray: '8 4',
  },
  svg: {
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35"/><script>parent.compromised=true</script></svg>',
    fillOverride: '#2563eb',
    strokeOverride: '#111111',
  },
  timeline: {
    timelineStart: '2000',
    timelineEnd: '2020',
    startDate: '2000',
    endDate: '2020',
    tickSpacing: 'auto',
    events: [
      {
        id: 'authored-event',
        date: '2010',
        title: 'Authored event',
        description: 'Authored event detail',
        side: 'top',
        connectorLength: 40,
        connectorOffset: 40,
      },
    ],
    textColor: '#111111',
  },
}
export const CANONICAL_ELEMENTS = Object.keys(ELEMENT_DEFAULTS)
export function ordinaryFixture(type) {
  if (type === 'game') return gameFixture('name-picker')
  return {
    ...structuredClone(ELEMENT_DEFAULTS[type]),
    id: `release-${type}`,
    type,
    x: 80,
    y: 40,
    width: 780,
    height: 440,
    ...structuredClone(authored[type]),
  }
}
export const ordinaryMutations = {
  text: ['width', 'Width', 740],
  image: ['alt', 'Image alternative text', 'Revised authored diagram'],
  shape: ['shape', 'Shape kind', 'hexagon', 'select'],
  code: ['fontSize', 'Code font size', 24],
  latex: ['fontSize', 'LaTeX font size', 28],
  html: ['width', 'Width', 740],
  markdown: ['fontSize', 'Markdown font size', 26],
  chart: ['legendPosition', 'Legend position', 'bottom', 'select'],
  video: ['transcript', 'Media transcript', 'Revised authored video transcript'],
  audio: ['transcript', 'Media transcript', 'Revised authored audio transcript'],
  table: ['fontSize', 'Table font size', 22],
  icon: ['iconStrokeWidth', 'Icon stroke width', 4],
  callout: ['calloutNumber', 'Callout Number', 23],
  qrcode: ['qrData', 'QR code data or URL', 'https://example.com/revised-release-19'],
  drawing: ['strokeWidth', 'Drawing stroke width', 10],
  line: ['strokeWidth', 'Line width', 8, 'range'],
  svg: ['width', 'Width', 740],
  timeline: ['fontSize', 'Timeline font size', 18],
  game: ['width', 'Width', 740],
}
