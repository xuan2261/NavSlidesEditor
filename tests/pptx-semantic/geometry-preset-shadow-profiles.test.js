import { describe, expect, it } from 'vitest'
import svg from '../../shared/src/pptx-geometry-svg.js'

const preset = { kind: 'prstShdw', prst: 'shdw19', color: { kind: 'srgb', value: '2060c0' } }
function fixture() {
  const geometry = {
    schemaVersion: 1,
    componentId: 'geometry',
    kind: 'custom',
    width: 100 * 9525,
    height: 80 * 9525,
    adjustments: [],
    guides: [],
    handles: [],
    paths: [
      {
        componentId: 'path',
        commands: [
          ...[
            [10, 10],
            [30, 10],
            [30, 30],
            [10, 30],
          ].map(([x, y], i) => ({
            kind: i ? 'lnTo' : 'moveTo',
            points: [{ componentId: `p${i}`, x: x * 9525, y: y * 9525 }],
          })),
          { kind: 'close' },
        ],
      },
    ],
    style: {
      fill: { color: { kind: 'srgb', value: 'e02030' } },
      effects: { kind: 'list', effects: [preset] },
    },
  }
  return {
    geometry,
    options: { width: 100, height: 80, fill: '#e02030', stroke: 'none', strokeWidth: 0 },
  }
}
describe('preset source ink admission', () => {
  it('anchors an inset polygon at its ink bottom, not its viewport bottom', () => {
    const f = fixture()
    expect(svg.geometrySvgPathsString(f.geometry, f.options)).toContain('matrix(1 0 0 0.5 0 15)')
  })
  it('does not approximate a curved envelope with its control-point hull', () => {
    const f = fixture(),
      command = f.geometry.paths[0].commands[1]
    command.kind = 'quadBezTo'
    command.points.push({ componentId: 'curve-end', x: 50 * 9525, y: 30 * 9525 })
    expect(() => svg.geometrySvgPathsString(f.geometry, f.options)).toThrow(
      /Unsupported preset shadow source ink envelope/
    )
  })
  it('does not substitute padded support bounds for painted stroke coverage', () => {
    const f = fixture()
    f.geometry.style.stroke = { color: { kind: 'srgb', value: '0000ff' }, width: 9525 }
    expect(() => svg.geometrySvgPathsString(f.geometry, f.options)).toThrow(
      /Unsupported preset shadow source ink envelope/
    )
  })
  it.each([
    { kind: 'outerShdw', dist: 190500, color: { kind: 'srgb', value: '000000' } },
    { kind: 'blur', rad: 28575 },
  ])('does not reuse the original envelope for unmeasured upstream %j', (upstream) => {
    const f = fixture()
    f.geometry.style.effects = { kind: 'dag', type: 'tree', effects: [upstream, preset] }
    expect(() => svg.geometrySvgPathsString(f.geometry, f.options)).toThrow(
      /Source ink envelope is required/
    )
  })
  it('does not emit a shadow for empty polygon coverage', () => {
    const f = fixture()
    f.geometry.paths[0].commands = f.geometry.paths[0].commands.slice(0, 2)
    expect(svg.geometrySvgPathsString(f.geometry, f.options)).not.toContain(
      'data-pptx-geometry-shadow='
    )
  })
})
