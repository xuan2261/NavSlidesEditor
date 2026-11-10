import { createRequire } from 'node:module'
import { compileGradientPath } from './geometry-gradient-svg-path-sampler.js'
const require = createRequire(import.meta.url)
const { DOMParser } = require('@xmldom/xmldom')

// Vector point sampling, including shipped clips, use matrices and RGBA fields.
// This avoids Skia's separate SVG color/pattern rasterizer; Chromium captures
// remain the visual integration check.
export function sampleGradientSvg(definitions, points, { background } = {}) {
  return sampleGradientSvgOnBackgrounds(definitions, points, [background])[0]
}

export function sampleGradientSvgOnBackgrounds(definitions, points, backgrounds) {
  const document = new DOMParser({
    onError: (_level, message) => { throw new Error(message) },
  }).parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${definitions}</svg>`, 'image/svg+xml')
  // Index the XML DOM once. Browser-specific collections and CSS selector
  // machinery are unnecessary for the generated vector vocabulary.
  const elements = new WeakMap(), ids = new Map()
  let pattern
  const index = (node) => {
    const children = []
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1) continue
      children.push(child)
      const id = child.getAttribute('id')
      if (id && !ids.has(id)) ids.set(id, child)
      if (!pattern && child.localName === 'pattern') pattern = child
      index(child)
    }
    elements.set(node, children)
  }
  index(document)
  const children = (node) => elements.get(node)
  const hasStopOpacity = (node) => children(node).some((child) =>
    child.hasAttribute('stop-opacity') || hasStopOpacity(child)
  )
  const paths = new WeakMap()
  const number = (node, name) => Number(node.getAttribute(name) ?? 0)
  const solidColor = (fill) =>
    fill === 'black'
      ? [0, 0, 0]
      : fill === 'white'
        ? [255, 255, 255]
        : fill.startsWith('#')
          ? fill
              .slice(1)
              .match(/../g)
              .map((channel) => parseInt(channel, 16))
          : fill.match(/[\d.]+/g).map(Number)
  const radialColor = (gradient, point) => {
    if (
      gradient.localName !== 'radialGradient' ||
      number(gradient, 'fx') !== number(gradient, 'cx') ||
      number(gradient, 'fy') !== number(gradient, 'cy') ||
      number(gradient, 'fr') !== 0 ||
      hasStopOpacity(gradient)
    )
      throw new Error('Unsupported sampler paint: only opaque concentric point-focus radial')
    const position =
      Math.hypot(point[0] - number(gradient, 'cx'), point[1] - number(gradient, 'cy')) /
      number(gradient, 'r')
    const stops = children(gradient)
    const index = stops.findIndex((stop) => number(stop, 'offset') >= position)
    if (index === 0 || index < 0)
      return solidColor(stops[index === 0 ? 0 : stops.length - 1].getAttribute('stop-color'))
    const start = stops[index - 1],
      end = stops[index],
      a = number(start, 'offset'),
      b = number(end, 'offset'),
      ratio = (position - a) / (b - a),
      rgb = solidColor(end.getAttribute('stop-color'))
    return solidColor(start.getAttribute('stop-color')).map(
      (channel, component) => channel + (rgb[component] - channel) * ratio
    )
  }
  const geometryContains = (node, [x, y]) => {
    switch (node.localName) {
      case 'rect':
        return (
          x >= number(node, 'x') &&
          y >= number(node, 'y') &&
          x <= number(node, 'x') + number(node, 'width') &&
          y <= number(node, 'y') + number(node, 'height')
        )
      case 'circle':
      case 'ellipse': {
        const rx = number(node, node.localName === 'circle' ? 'r' : 'rx')
        const ry = number(node, node.localName === 'circle' ? 'r' : 'ry')
        return ((x - number(node, 'cx')) / rx) ** 2 + ((y - number(node, 'cy')) / ry) ** 2 <= 1
      }
      case 'polygon':
      case 'path': {
        if (!paths.has(node))
          paths.set(
            node,
            compileGradientPath(
              node.localName === 'polygon'
                ? `M${node.getAttribute('points')}Z`
                : node.getAttribute('d')
            )
          )
        return paths.get(node)(x, y, node.getAttribute('clip-rule') ?? 'nonzero')
      }
      default:
        throw new Error(`Unsupported sampler geometry: ${node.localName}`)
    }
  }
  const over = (front, back = [0, 0, 0, 0]) =>
    front ? front.map((value, index) => value + back[index] * (1 - front[3])) : back
  const filterColor = (filter, point) => {
    const results = new Map()
    let result
    for (const primitive of children(filter)) {
      const input = results.get(primitive.getAttribute('in'))
      if (primitive.localName === 'feImage') {
        const image = ids.get(primitive.getAttribute('href').slice(1))
        const [x, y, width, height] = image.getAttribute('viewBox').split(/\s+/).map(Number)
        result = draw(image, [
          x + ((point[0] - number(primitive, 'x')) * width) / number(primitive, 'width'),
          y + ((point[1] - number(primitive, 'y')) * height) / number(primitive, 'height'),
        ])
      } else if (
        primitive.localName === 'feColorMatrix' &&
        primitive.getAttribute('type') === 'matrix'
      ) {
        const matrix = primitive.getAttribute('values').split(/\s+/).map(Number)
        const straight = input.map((value, index) =>
          index < 3 && input[3] ? value / input[3] : value
        )
        result = Array.from({ length: 4 }, (_, row) =>
          Math.max(
            0,
            Math.min(
              1,
              matrix[row * 5 + 4] +
                straight.reduce((sum, value, column) => sum + value * matrix[row * 5 + column], 0)
            )
          )
        )
        result = result.map((value, index) => (index < 3 ? value * result[3] : value))
      } else if (
        primitive.localName === 'feComposite' &&
        primitive.getAttribute('operator') === 'arithmetic'
      ) {
        const other = results.get(primitive.getAttribute('in2'))
        result = input.map((value, index) =>
          Math.max(
            0,
            Math.min(
              1,
              number(primitive, 'k1') * value * other[index] +
                number(primitive, 'k2') * value +
                number(primitive, 'k3') * other[index] +
                number(primitive, 'k4')
            )
          )
        )
      } else throw new Error(`Unsupported sampler filter: ${primitive.localName}`)
      results.set(primitive.getAttribute('result'), result)
    }
    return result
  }
  const drawChildren = (node, point, fill) => {
    const visible = []
    // An opaque sample hides every earlier sibling at this point. Retain the
    // remaining paints and composite in the original order to keep rounding,
    // group opacity and premultiplied filter behavior unchanged.
    const siblings = children(node)
    for (let index = siblings.length - 1; index >= 0; index--) {
      const paint = draw(siblings[index], point, fill)
      if (!paint) continue
      visible.push(paint)
      if (paint[3] === 1) break
    }
    let paint = [0, 0, 0, 0]
    for (let index = visible.length - 1; index >= 0; index--)
      paint = over(visible[index], paint)
    return paint
  }
  const draw = (node, point, inheritedFill) => {
    const fill = node.getAttribute('fill') ?? inheritedFill
    const clip = node.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1]
    if (
      clip &&
      !children(ids.get(clip)).some((child) => geometryContains(child, point))
    )
      return undefined
    if (node.localName === 'use') {
      const [a, b, c, d, e, f] = node
        .getAttribute('transform')
        .match(/matrix\(([^)]+)\)/)[1]
        .split(/\s+/)
        .map(Number)
      const determinant = a * d - b * c
      const x = point[0] - e,
        y = point[1] - f
      return draw(
        ids.get(node.getAttribute('href').slice(1)),
        [(d * x - c * y) / determinant, (-b * x + a * y) / determinant],
        fill
      )
    }
    if (node.localName === 'g' || node.localName === 'svg') {
      const paint = drawChildren(node, point, fill)
      const opacity = node.hasAttribute('opacity') ? number(node, 'opacity') : 1
      return paint.map((value) => value * opacity)
    }
    if (!geometryContains(node, point)) return undefined
    const filter = node.getAttribute('filter')?.match(/^url\(#(.+)\)$/)?.[1]
    if (filter) return filterColor(ids.get(filter), point)
    const color = fill.startsWith('url(#')
      ? radialColor(ids.get(fill.slice(5, -1)), point)
      : solidColor(fill)
    const alpha = node.hasAttribute('fill-opacity') ? number(node, 'fill-opacity') : 1
    return [...color.map((channel) => (channel / 255) * alpha), alpha]
  }
  const paints = points.map((point) => {
    const local = ['x', 'y'].map((axis, index) => {
      const extent = number(pattern, index === 0 ? 'width' : 'height')
      const coordinate = point[index] - number(pattern, axis)
      return ((coordinate % extent) + extent) % extent
    })
    return drawChildren(pattern, local)
  })
  const result = backgrounds.map((background) =>
    paints.map((paint) => {
      if (background)
        return over(paint, [...background.map((channel) => channel / 255), 1])
          .slice(0, 3)
          .map((channel) => channel * 255)
      return paint[3] ? paint.slice(0, 3).map((channel) => (channel * 255) / paint[3]) : undefined
    })
  )
  return result
}
