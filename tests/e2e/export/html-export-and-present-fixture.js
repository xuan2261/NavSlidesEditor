export const SAMPLE_SLIDES = [
  {
    id: 'slide-1',
    elements: [
      {
        id: 'text-1',
        type: 'text',
        x: 100,
        y: 100,
        width: 600,
        height: 80,
        content: '<h1>Slide One</h1>',
      },
      {
        id: 'fragment-1',
        type: 'text',
        x: 100,
        y: 200,
        width: 600,
        height: 80,
        content: '<p>Fragment One</p>',
        fragment: true,
        fragmentIndex: 0,
      },
    ],
    notes: 'note one',
    background: { type: 'color', color: '#1e1e2e' },
    children: [
      {
        id: 'slide-1-child',
        elements: [
          {
            id: 'child-text',
            type: 'text',
            x: 100,
            y: 100,
            width: 600,
            height: 80,
            content: '<h2>Vertical Child</h2>',
          },
        ],
        speakerNotes: 'vertical note',
      },
    ],
  },
  {
    id: 'slide-2',
    elements: [
      {
        id: 'text-2',
        type: 'text',
        x: 100,
        y: 100,
        width: 600,
        height: 80,
        content: '<p>Body text</p>',
      },
    ],
    notes: '',
    background: { type: 'color', color: '#0f172a' },
  },
]
