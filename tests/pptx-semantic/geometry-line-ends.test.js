// @vitest-environment jsdom
import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { geometrySvgPathsString } = require('../../shared/src/pptx-geometry-svg')
function line(ends = {}) {
  return {
    schemaVersion: 1,
    componentId: 'geometry',
    kind: 'custom',
    width: 952500,
    height: 952500,
    style: {
      stroke: { color: { kind: 'srgb', value: '2468AC' }, width: 38100, cap: 'flat', ...ends },
    },
    paths: [
      {
        componentId: 'path',
        fill: 'none',
        stroke: true,
        commands: [
          { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
          { kind: 'lnTo', points: [{ componentId: 'end', x: 952500, y: 0 }] },
        ],
      },
    ],
  }
}
function render(geometry) {
  const root = document.createElement('div')
  root.innerHTML = `<svg>${geometrySvgPathsString(geometry, {
    width: 100,
    height: 100,
    fill: '#FF0000',
    stroke: '#000000',
    strokeWidth: 1,
  })}</svg>`
  return root
}

it('tip-attaches source-native triangle geometry and shortens the shaft without rewriting source', () => {
  const source = line({
    headEnd: { type: 'triangle', w: 'med', len: 'med' },
    tailEnd: { type: 'triangle', w: 'med', len: 'med' },
  })
  const before = structuredClone(source)
  const root = render(source)
  const head = root.querySelector('[data-pptx-line-end="headEnd"]')
  const tail = root.querySelector('[data-pptx-line-end="tailEnd"]')
  expect(head?.getAttribute('transform')).toBe('matrix(-1 0 0 -1 0 0)')
  expect(tail?.getAttribute('transform')).toBe('matrix(1 0 0 1 100 0)')
  expect(head.querySelector('path').getAttribute('d')).toBe('M 0 0 L -12 -6 L -12 6 Z')
  expect(head.querySelector('path').style.fill).toBe('#2468AC')
  expect(root.querySelector('[data-pptx-geometry-path="path"]').getAttribute('d')).toBe(
    'M 10 0 L 90 0'
  )
  expect(source).toEqual(before)
})

it.each([
  ['sm', 'sm', 8, 4],
  ['sm', 'med', 12, 4],
  ['sm', 'lg', 20, 4],
  ['med', 'sm', 8, 6],
  ['med', 'med', 12, 6],
  ['med', 'lg', 20, 6],
  ['lg', 'sm', 8, 10],
  ['lg', 'med', 12, 10],
  ['lg', 'lg', 20, 10],
])(
  'uses independently sized closed ink from the 3pt native vector reference: %s/%s',
  (w, len, length, halfWidth) => {
    const root = render(line({ tailEnd: { type: 'triangle', w, len } }))
    expect(root.querySelector('[data-pptx-line-end="tailEnd"] path')?.getAttribute('d')).toBe(
      `M 0 0 L -${length} -${halfWidth} L -${length} ${halfWidth} Z`
    )
  }
)

it.each(['diamond', 'oval'])('centers native %s on the endpoint instead of tip-docking', (type) => {
  const root = render(line({ tailEnd: { type, w: 'med', len: 'med' } }))
  const end = root.querySelector('[data-pptx-line-end="tailEnd"]')
  expect(end?.getAttribute('transform')).toBe('matrix(1 0 0 1 100 0)')
  expect(end.getAttribute('data-pptx-line-end-type')).toBe(type)
  expect(end.querySelector('path,ellipse').style.fill).toBe('#2468AC')
  if (type === 'diamond')
    expect(end.querySelector('path').getAttribute('d')).toBe('M 6 0 L 0 -6 L -6 0 L 0 6 Z')
  else
    expect([
      end.querySelector('ellipse').getAttribute('rx'),
      end.querySelector('ellipse').getAttribute('ry'),
    ]).toEqual(['6', '6'])
  expect(root.querySelector('[data-pptx-geometry-path="path"]').getAttribute('d')).toBe(
    'M 0 0 L 100 0'
  )
})

it('keeps native open-arrow ink distinct from a filled triangle and independent of shaft dash', () => {
  const source = line({
    tailEnd: { type: 'arrow', w: 'med', len: 'med' },
    dash: { kind: 'preset', value: 'dash' },
  })
  const root = render(source)
  const arrow = root.querySelector('[data-pptx-line-end="tailEnd"] path')
  expect(arrow?.style.fill).toBe('none')
  expect(arrow.style.stroke).toBe('#2468AC')
  expect(arrow.getAttribute('stroke-width')).toBe('4')
  expect(arrow.getAttribute('stroke-linecap')).toBe('round')
  expect(arrow.getAttribute('stroke-linejoin')).toBe('miter')
  expect(arrow.hasAttribute('stroke-dasharray')).toBe(false)
  expect(
    root.querySelector('[data-pptx-geometry-path="path"]').getAttribute('stroke-dasharray')
  ).toBe('16 12')
})

it('does not scale arrow ink twice by the authored path grid', () => {
  const source = line({ tailEnd: { type: 'triangle' } })
  source.paths[0].width = 100
  source.paths[0].height = 100
  source.paths[0].commands[1].points[0].x = 100
  const root = render(source)
  expect(root.querySelector('[data-pptx-line-end="tailEnd"]')?.getAttribute('transform')).toBe(
    'matrix(1 0 0 1 100 0)'
  )
  expect(root.querySelector('[data-pptx-line-end="tailEnd"] path').getAttribute('d')).toBe(
    'M 0 0 L -12 -6 L -12 6 Z'
  )
  expect(source.style.stroke.tailEnd).toEqual({ type: 'triangle' })
})

it('preserves authored fill path while trimming only stroke ink', () => {
  const source = line({ tailEnd: { type: 'triangle' } })
  source.paths[0].fill = 'norm'
  const root = render(source)
  expect(root.querySelector('[data-pptx-geometry-fill="path"]')?.getAttribute('d')).toBe(
    'M 0 0 L 100 0'
  )
  expect(root.querySelector('[data-pptx-geometry-fill="path"]').style.fill).toBe('#FF0000')
  expect(root.querySelector('[data-pptx-geometry-path="path"]').style.fill).toBe('none')
  expect(root.querySelector('[data-pptx-geometry-path="path"]').getAttribute('d')).toBe(
    'M 0 0 L 90 0'
  )
})

it.each(['none', 'empty', 'closed', 'no-stroke', 'zero-length', 'zero-width'])(
  'does not invent decorations for %s paths',
  (mode) => {
    const source = line({
      tailEnd: mode === 'none' ? { type: 'none' } : mode === 'empty' ? {} : { type: 'triangle' },
    })
    if (mode === 'closed') source.paths[0].commands.push({ kind: 'close' })
    if (mode === 'no-stroke') source.paths[0].stroke = false
    if (mode === 'zero-length') source.paths[0].commands[1].points[0].x = 0
    if (mode === 'zero-width') source.style.stroke.width = 0
    expect(render(source).querySelector('[data-pptx-line-end]')).toBeNull()
  }
)

it('uses projected traversal on an authored zero axis and retains local displacement', () => {
  const source = line({ tailEnd: { type: 'triangle' } })
  source.height = 0
  source.paths[0].commands[0].points[0].localOffset = { x: 95250, y: 19050 }
  source.paths[0].commands[1].points[0].localOffset = { x: 95250, y: 19050 }
  const root = render(source)
  expect(root.querySelector('[data-pptx-line-end="tailEnd"]')?.getAttribute('transform')).toBe(
    'matrix(1 0 0 1 110 2)'
  )
  expect(root.querySelector('[data-pptx-geometry-path="path"]').getAttribute('d')).toBe(
    'M 10 2 L 100 2'
  )
})

it('retains canonical cubic ink when shortening a curved shaft', () => {
  const source = line({ tailEnd: { type: 'triangle' } })
  source.paths[0].commands[1] = {
    kind: 'cubicBezTo',
    points: [
      { componentId: 'c1', x: 0, y: 952500 },
      { componentId: 'c2', x: 952500, y: 952500 },
      { componentId: 'end', x: 952500, y: 0 },
    ],
  }
  const before = structuredClone(source)
  const root = render(source)
  expect(root.querySelector('[data-pptx-line-end="tailEnd"]')).not.toBeNull()
  const d = root.querySelector('[data-pptx-geometry-path="path"]').getAttribute('d')
  expect(d).toContain(' C ')
  expect(d).not.toBe('M 0 0 C 0 100 100 100 100 0')
  expect(source).toEqual(before)
})
