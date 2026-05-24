export const VISUAL_MATRIX_THEMES = ['black', 'white', 'league']
export const VISUAL_MATRIX_TRANSITIONS = ['none', 'fade', 'slide']

export const VISUAL_MATRIX_LAYOUTS = [
  { id: 'blank', label: 'Blank', expectedText: null, elements: [] },
  {
    id: 'title',
    label: 'Title Slide',
    expectedText: 'Matrix Title',
    elements: [
      {
        id: 'matrix-title-heading',
        type: 'text',
        x: 80,
        y: 160,
        width: 800,
        height: 120,
        zIndex: 1,
        content: '<h1 style="text-align:center">Matrix Title</h1>',
      },
    ],
  },
  {
    id: 'two-column',
    label: 'Two Column',
    expectedText: 'Left Column',
    elements: [
      { id: 'matrix-left', type: 'text', x: 60, y: 90, width: 390, height: 320, zIndex: 1, content: '<h2>Left Column</h2><p>Alpha content</p>' },
      { id: 'matrix-right', type: 'text', x: 510, y: 90, width: 390, height: 320, zIndex: 2, content: '<h2>Right Column</h2><p>Beta content</p>' },
    ],
  },
  {
    id: 'comparison',
    label: 'Comparison',
    expectedText: 'Comparison',
    elements: [
      { id: 'matrix-comparison-title', type: 'text', x: 40, y: 30, width: 880, height: 70, zIndex: 1, content: '<h2 style="text-align:center">Comparison</h2>' },
      { id: 'matrix-option-a', type: 'text', x: 60, y: 140, width: 380, height: 120, zIndex: 2, content: '<h3>Option A</h3>' },
      { id: 'matrix-option-b', type: 'text', x: 520, y: 140, width: 380, height: 120, zIndex: 3, content: '<h3>Option B</h3>' },
    ],
  },
]

export const VISUAL_MATRIX_SNAPSHOT_BASELINES = new Set([
  'black-fade-title',
  'white-none-two-column',
  'league-slide-comparison',
])
