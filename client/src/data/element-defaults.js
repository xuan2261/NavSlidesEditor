/**
 * Default property values for each element type.
 * Used by createElement() in element-factory.js.
 */
export const ELEMENT_DEFAULTS = {
  text: {
    width: 600,
    height: 180,
    zIndex: 1,
    content: '<p>New text</p>',
  },
  image: {
    width: 400,
    height: 300,
    zIndex: 2,
    src: '',
    objectFit: 'contain',
    alt: '',
  },
  shape: {
    width: 200,
    height: 150,
    zIndex: 1,
    shape: 'rect',
    fill: '#6366f1',
    stroke: 'none',
    strokeWidth: 0,
    borderRadius: 0,
    opacity: 1,
    text: '',
    fontSize: 16,
    textColor: '#ffffff',
  },
  code: {
    width: 600,
    height: 320,
    zIndex: 2,
    content: '// Write your code here\nfunction hello() {\n  return "Hello, World!"\n}',
    language: 'javascript',
    fontSize: 14,
  },
  latex: {
    width: 500,
    height: 380,
    zIndex: 2,
    content: `\\\\begin{tikzpicture}
  \\\\draw[thick,->] (0,0) -- (4,0) node[right] {$x$};
  \\\\draw[thick,->] (0,0) -- (0,3) node[above] {$y$};
  \\\\draw[blue,thick] (0,0) sin (1,1) cos (2,0) sin (3,-1) cos (4,0);
  \\\\node at (2,-0.8) {$f(x) = \\\\sin(x)$};
\\\\end{tikzpicture}`,
  },
  html: {
    width: 500,
    height: 380,
    zIndex: 2,
    content: `<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<style>* { box-sizing: border-box; margin: 0; } body { background: transparent; overflow: hidden; }</style>
<svg id="viz" width="100%" height="100%" style="display:block;"></svg>
<script>
const W = window.innerWidth, H = window.innerHeight;
const svg = d3.select('#viz').attr('viewBox', \`0 0 \${W} \${H}\`);
const data = Array.from({length: 30}, () => ({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*20 }));
svg.selectAll('circle').data(data).join('circle')
  .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
  .attr('fill', (d,i) => d3.schemeTableau10[i%10]).attr('opacity', 0.8);
</script>`,
  },
  markdown: {
    width: 600,
    height: 380,
    zIndex: 2,
    content:
      '## Hello Markdown\n\n- Item one\n- Item two\n- Item three\n\n**Bold** and *italic* text with [links](https://example.com).\n\n```python\ndef hello():\n    print("Hello!")\n```',
  },
  chart: {
    width: 500,
    height: 380,
    zIndex: 2,
    chartType: 'bar',
    chartData: {
      labels: ['A', 'B', 'C', 'D', 'E'],
      datasets: [{ label: 'Series 1', data: [12, 19, 8, 15, 10], color: '#6366f1' }],
    },
  },
  video: {
    width: 480,
    height: 270,
    zIndex: 2,
    src: '',
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
    objectFit: 'contain',
    poster: '',
  },
  audio: {
    width: 400,
    height: 60,
    zIndex: 2,
    src: '',
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
  },
  table: {
    width: 600,
    height: 300,
    zIndex: 2,
    data: [
      ['Header 1', 'Header 2', 'Header 3'],
      ['', '', ''],
      ['', '', ''],
    ],
    headerRow: true,
    cellPadding: 8,
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    headerBgColor: 'rgba(99,102,241,0.3)',
    cellBgColor: 'transparent',
    textColor: '#ffffff',
    fontSize: 14,
    // Phase 3: Extended schema
    headerTextColor: '#1e40af',
    headerIsBold: true,
    borderStyle: 'solid', // 'solid' | 'dashed' | 'dotted'
    // Per-cell styling (2D arrays indexed [row][col], null = inherit default)
    cellStyles: {
      textColors: [],   // [[null, '#ff0000', null], ...]
      bgColors: [],      // [[null, '#ffff00', null], ...]
      isBold: [],        // [[false, true, false], ...]
      aligns: [],        // [['left', 'center', 'right'], ...]
      vAligns: [],       // [['top', 'middle', 'bottom'], ...]
    },
    // Merged cells
    mergedCells: [],     // [{ row: 0, col: 1, rowSpan: 1, colSpan: 2 }]
    // Sizing
    colWidths: [],
    rowHeights: [],
  },
  icon: {
    width: 80,
    height: 80,
    zIndex: 2,
    iconName: 'Star',
    iconColor: '#ffffff',
    iconStrokeWidth: 2,
  },
  callout: {
    width: 36,
    height: 36,
    zIndex: 10,
    calloutNumber: 1,
    calloutColor: '#ef4444',
    calloutTextColor: '#ffffff',
    fontSize: 16,
  },
  qrcode: {
    width: 200,
    height: 200,
    zIndex: 2,
    qrData: 'https://example.com',
    qrColor: '#000000',
    qrBgColor: '#ffffff',
    qrErrorLevel: 'M',
  },
  drawing: {
    width: 960,
    height: 540,
    zIndex: 1,
    paths: [],
    strokeColor: '#ffffff',
    strokeWidth: 3,
  },
  line: {
    width: 400,
    height: 200,
    zIndex: 1,
    x1: 0,
    y1: 100,
    x2: 400,
    y2: 100,
    cx: null,
    cy: null,
    stroke: '#ffffff',
    strokeWidth: 2,
    arrowStart: 'none',
    arrowEnd: 'arrow',
    dashArray: '',
  },
  svg: {
    width: 200,
    height: 200,
    zIndex: 1,
    content:
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#6366f1"/></svg>',
    fillOverride: null,
    strokeOverride: null,
  },
  game: {
    type: 'game',
    width: 640,
    height: 480,
    zIndex: 5,
    backgroundColor: '#1a1a2e',
    accentColor: '#6366f1',
    fontFamily: 'sans-serif',
    showSoundEffects: true,
    gameStatus: 'setup',
    'name-picker': {
      pickerMode: 'wheel',
      items: ['Học sinh 1', 'Học sinh 2', 'Học sinh 3', 'Học sinh 4',
              'Học sinh 5', 'Học sinh 6', 'Học sinh 7', 'Học sinh 8'],
      wheelSegments: 8,
      wheelColors: ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#FF9800', '#795548'],
      diceCount: 2,
      weighted: false,
      excludeAfterPick: true,
      animationDuration: 2500,
    },
    'hot-potato': {
      title: 'Hot Potato Quiz',
      questions: [],
      currentQuestion: 0,
      allowLate: false,
      showLeaderboard: true,
      shuffleQuestions: false,
    },
    'jeopardy': {
      title: 'Jeopardy',
      teams: [],
      categories: [],
      questions: {},
      dailyDouble: [],
    },
    'four-corners': {
      cornerCount: 4,
      eliminateMode: 'wrong',
      showTimer: true,
    },
    'relay-race': {
      questionsPerRound: 4,
      shuffleTeams: true,
      passOnWrong: true,
    },
    'trivia-champ': {
      rounds: [],
      lightningRound: { enabled: false, timePerQ: 10 },
      jackpotRound: { enabled: false, multiplier: 2 },
    },
    'scattergories': {
      timePerRound: 60,
      letterMode: 'random',
      categories: [],
      scoring: 'unique',
    },
  },
}

// Default position for each type (can be overridden)
export const DEFAULT_POSITIONS = {
  text: { x: 80, y: 160 },
  image: { x: 130, y: 100 },
  shape: { x: 'center', y: 'center' }, // calculated based on canvas
  code: { x: 80, y: 80 },
  latex: { x: 80, y: 80 },
  html: { x: 80, y: 80 },
  markdown: { x: 80, y: 80 },
  chart: { x: 80, y: 80 },
  video: { x: 130, y: 100 },
  audio: { x: 80, y: 400 },
  table: { x: 80, y: 100 },
  icon: { x: 200, y: 200 },
  callout: { x: 200, y: 200 },
  qrcode: { x: 380, y: 170 },
  drawing: { x: 0, y: 0 },
  line: { x: 100, y: 200 },
  svg: { x: 200, y: 100 },
  game: { x: 160, y: 120 },
}
