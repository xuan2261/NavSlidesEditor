import { expect, it } from 'vitest'
import { sampleGradientSvgOnBackgrounds } from './geometry-gradient-svg-sampler.js'

const fixtures = [
  {
    name: 'opaque concentric radial with decoded entity attributes',
    definitions: '<defs><radialGradient id="color" cx="10" cy="10" r="10" fx="10" fy="10" fr="0"><stop offset="0" stop-color="&#35;ff0000"/><stop offset="1" stop-color="#0000ff"/></radialGradient><pattern width="20" height="20"><circle cx="10" cy="10" r="10" fill="url(#color)"/></pattern></defs>',
  },
  {
    name: 'clipped reflected relative lines and exact ellipse arcs',
    definitions: '<defs><clipPath id="clip"><rect x="2" y="2" width="16" height="16"/></clipPath><path id="shape" d="M2 10A8 6 0 1 1 18 10l-8 6L2 10Z"/><pattern width="20" height="20"><g clip-path="url(#clip)" opacity="0.75"><use href="#shape" transform="matrix(-1 0 0 1 20 0)" fill="rgb(40,120,200)"/></g></pattern></defs>',
  },
  {
    name: 'premultiplied image filter on two backgrounds',
    definitions: '<defs><svg id="p" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" fill="black"/><rect x="2" y="2" width="16" height="16" fill="rgb(80,40,20)"/></svg><svg id="q" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" fill="white"/><rect x="2" y="2" width="16" height="16" fill="rgb(127,127,127)"/></svg><filter id="rgba"><feImage href="#p" x="0" y="0" width="20" height="20" result="p"/><feImage href="#q" x="0" y="0" width="20" height="20" result="q"/><feColorMatrix in="q" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="qa"/><feComposite in="p" in2="qa" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0"/></filter><pattern width="20" height="20"><rect width="20" height="20" fill="black" filter="url(#rgba)"/></pattern></defs>',
  },
]

it.each(fixtures)('retains exact XML DOM sampling: $name', ({ definitions }) => {
  expect(sampleGradientSvgOnBackgrounds(definitions, [
    [0.5, 0.5], [2.25, 10.25], [5.25, 5.25], [10.25, 10.25],
    [17.75, 10.25], [19.5, 19.5], [-9.75, 30.25], [30.25, -9.75],
  ], [undefined, [255, 255, 255], [15, 30, 45]])).toMatchSnapshot()
})

it('rejects malformed XML rather than sampling a repaired tree', () => {
  expect(() => sampleGradientSvgOnBackgrounds('<pattern width="20" height="20"><rect></pattern>', [[1, 1]], [undefined])).toThrow()
})
