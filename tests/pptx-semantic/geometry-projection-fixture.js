// Synthetic operation fixture, not native corpus visual evidence.
export function geometryProjectionFixture() {
  const geometry = {
    schemaVersion: 1,
    componentId: 'geometry',
    kind: 'custom',
    width: 100,
    height: 80,
    adjustments: [{ name: 'adj', formula: 'val 25000' }],
    guides: [{ name: 'tip', formula: '*/ w adj 100000' }],
    handles: [
      {
        componentId: 'handle',
        kind: 'xy',
        position: { x: 'tip', y: 0 },
        gdRefX: 'adj',
        minX: 0,
        maxX: 100000,
      },
    ],
    paths: [
      {
        componentId: 'path',
        commands: [
          { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
          {
            kind: 'cubicBezTo',
            points: [
              { componentId: 'control', x: 'tip', y: 10 },
              { componentId: 'second', x: 60, y: 50 },
              { componentId: 'end', x: 100, y: 80 },
            ],
          },
          { kind: 'close' },
        ],
      },
    ],
  }
  const element = (id) => ({
    id,
    pptxInstanceId: id,
    type: 'shape',
    shape: 'rect',
    fill: '#123456',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    stroke: 'none',
    strokeWidth: 0,
  })
  const instance = (id, slideId) => ({
    id,
    slideId,
    definitionId: 'definition',
    parentInstanceId: null,
    localTransform: [-1, 0, 0, 1, 952500, 0],
    paintIndex: 0,
    overrides: {},
  })
  return {
    title: 'Geometry fixture',
    slides: [
      { id: 's1', elements: [element('i1')] },
      { id: 's2', elements: [element('i2')] },
    ],
    pptxSemantic: {
      schemaVersion: 1,
      styles: {},
      fonts: {},
      definitions: {
        definition: {
          id: 'definition',
          kind: 'shape',
          source: {
            partUri: 'ppt/slides/slide7.xml',
            nativeId: '2',
            preconditionHash: 'a'.repeat(64),
          },
          components: ['geometry', 'start', 'control', 'second', 'end'].map((id, index) => ({
            id,
            kind: id === 'geometry' ? 'property' : 'control-point',
            locator: { path: [0, 0, index], preconditionHash: 'a'.repeat(64) },
          })),
          content: { extent: { cx: 952500, cy: 762000 }, geometry },
        },
      },
      instances: { i1: instance('i1', 's1'), i2: instance('i2', 's2') },
    },
  }
}
