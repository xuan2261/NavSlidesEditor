const { IDENTITY } = require('./pptx-affine')
const { geometryFillPaint } = require('./pptx-geometry-document')
const {
  validateGeometryEffectProgram,
  compileGeometryEffectGraph,
} = require('./pptx-geometry-effect-program')
const {
  geometrySingleEffectSvg,
  geometryOuterShadowImage,
  geometryEffectFrame,
} = require('./pptx-geometry-effects')
const { geometryGlowSvg } = require('./pptx-geometry-effect-glow')
const { geometryInnerShadowSvg } = require('./pptx-geometry-effect-inner-shadow')
const { geometryBlurSvg } = require('./pptx-geometry-effect-blur')
const { geometrySoftEdgeSvg } = require('./pptx-geometry-effect-soft-edge')
const { resolveGeometryColorPaint } = require('./pptx-geometry-color')
const { gradientPaintId, gradientSvgDefinition } = require('./pptx-geometry-gradient')
const { patternPaintId, patternSvgDefinition } = require('./pptx-geometry-pattern')
const { blipPaintId, blipSvgDefinition } = require('./pptx-geometry-blip')

const empty = { ink: '', bounds: null }
const union = (a, b) =>
  !a
    ? b
    : !b
      ? a
      : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
const expand = (bounds, pad) => [bounds[0] - pad, bounds[1] - pad, bounds[2] + pad, bounds[3] + pad]
const merge = (...images) => ({
  ink: images.map((image) => image.ink).join(''),
  bounds: images.reduce((bounds, image) => union(bounds, image.bounds), null),
})
function presetShadows(effect) {
  // ECMA-376 Part 1, 5th edition, 20.1.10.52, printed pp. 2987-2989.
  // No UI preset guesses. shdw3 explicitly specifies ky (not kx).
  const presets = {
    shdw1: {},
    shdw2: {},
    shdw3: { algn: 'b', ky: 2453400, sy: 50000 },
    shdw4: { algn: 'b', kx: -2453400, sy: 50000 },
    shdw5: {},
    shdw6: {},
    shdw7: { algn: 'b', kx: 2453400, sy: -50000 },
    shdw8: { algn: 'b', kx: -2453400, sy: -50000 },
    shdw9: { algn: 'tl', sx: 75000, sy: 75000 },
    shdw10: { algn: 'br', sx: 125000, sy: 125000 },
    shdw11: { algn: 'b', kx: 2453400, sy: 50000 },
    shdw12: { algn: 'b', kx: -2453400, sy: 50000 },
    shdw13: {},
    shdw14: {},
    shdw15: { algn: 'b', kx: 2453400, sy: -50000 },
    shdw16: { algn: 'b', kx: -2453400, sy: -50000 },
    shdw17: {},
    shdw18: {},
    // Installed PowerPoint discriminator: percent scales, not angular projections.
    shdw19: { algn: 'b', sy: 50000 },
    shdw20: { algn: 'b', sy: -100000 },
  }
  if (!Object.hasOwn(presets, effect.prst))
    throw new TypeError(`Unresolved normative preset shadow scale: ${effect.prst}`)
  const first = {
    kind: 'outerShdw',
    color: effect.color,
    rotWithShape: false,
    ...(effect.dist === undefined ? {} : { dist: effect.dist }),
    ...(effect.dir === undefined ? {} : { dir: effect.dir }),
    ...presets[effect.prst],
  }
  if (!['shdw13', 'shdw17', 'shdw18'].includes(effect.prst)) return [first]
  const paint = resolveGeometryColorPaint(effect.color)
  const rgb = paint.rgb
    .match(/../g)
    .map((c) =>
      Math.min(255, parseInt(c, 16) + 102)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
  const second = {
    ...first,
    color: {
      kind: 'srgb',
      value: rgb,
      transforms: [{ kind: 'alpha', value: Math.round(paint.alpha * 100000) }],
    },
    ...(effect.prst === 'shdw13'
      ? { dist: (effect.dist ?? 0) * 2 }
      : { dir: ((effect.dir ?? 0) + 10800000) % 21600000 }),
  }
  return [second, first]
}
function geometryEffectResult(geometry, options) {
  const settings = { ...options, occurrenceMatrix: options.occurrenceMatrix ?? IDENTITY }
  const source = { ink: settings.ink, bounds: settings.bounds }
  const program = geometry.style?.effects
  if (program === undefined || Array.isArray(program)) return source
  validateGeometryEffectProgram(program, {
    fill: (fill) => {
      geometryFillPaint({ ...geometry, style: { fill } })
      return true
    },
  })
  if (!program.effects.length) return source
  const key = JSON.stringify([geometry.componentId, program, settings])
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  const prefix = 'pptx-effect-' + hash.toString(16)
  let serial = 0
  const definitions = []
  const id = () => prefix + '-' + serial++
  const inkEnvelopes = new Map()
  if (settings.presetInkBounds !== undefined) {
    inkEnvelopes.set(source.ink, settings.presetInkBounds)
    if (settings.sourceImages?.fill && !settings.sourceImages?.line?.ink)
      inkEnvelopes.set(settings.sourceImages.fill.ink, settings.presetInkBounds)
  }
  function capture(image) {
    if (!image.ink || !image.bounds) return empty
    const name = id()
    definitions.push(`<g id="${name}">${image.ink}</g>`)
    const captured = {
      ink: `<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#${name}"/>`,
      bounds: image.bounds,
    }
    if (inkEnvelopes.has(image.ink)) inkEnvelopes.set(captured.ink, inkEnvelopes.get(image.ink))
    return captured
  }
  function overlay(effect, input) {
    const fillGeometry = { ...geometry, style: { fill: effect.fill } }
    const paint = geometryFillPaint(fillGeometry)
    if (paint.fill === 'none') return input
    const name = id(),
      b = input.bounds
    const region = `x="${b[0]}" y="${b[1]}" width="${b[2] - b[0]}" height="${b[3] - b[1]}"`
    let fill
    if (effect.fill.color) {
      const color = resolveGeometryColorPaint(effect.fill.color)
      fill = `<feFlood flood-color="#${color.rgb}" flood-opacity="${color.alpha}" result="paint"/>`
    } else {
      // Overlay paint belongs to this leaf, independently of an inherited
      // group-owned base fill. The paint modules' default frame is leaf-local.
      const paintOptions = { ...settings, nativeStroke: true, fillFrame: undefined }
      let definition, paintId
      if (effect.fill.gradient) {
        definition = gradientSvgDefinition(fillGeometry, paintOptions)
        paintId = gradientPaintId(fillGeometry)
      } else if (effect.fill.pattern) {
        definition = patternSvgDefinition(fillGeometry, paintOptions)
        paintId = patternPaintId(fillGeometry, paintOptions)
      } else if (effect.fill.blip) {
        const imageOptions = {
          ...paintOptions,
          asset: settings.effectFillAssets?.[effect.fill.blip.bindingId],
        }
        definition = blipSvgDefinition(fillGeometry, imageOptions)
        paintId = blipPaintId(fillGeometry, imageOptions)
      } else throw new TypeError('Effect overlay group fill requires a resolved paint input')
      const imageId = id()
      definitions.push(
        `${definition}<svg id="${imageId}" ${region} viewBox="${b[0]} ${b[1]} ${b[2] - b[0]} ${b[3] - b[1]}"><rect ${region} fill="url(#${paintId})"/></svg>`
      )
      fill = `<feImage xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#${imageId}" ${region} result="paint"/>`
    }
    const mode = {
      over: 'normal',
      mult: 'multiply',
      screen: 'screen',
      darken: 'darken',
      lighten: 'lighten',
    }[effect.blend]
    // Work in straight source color on an opaque temporary image, then restore
    // the original alpha once. Masking a translucent over result twice is wrong.
    return {
      ink: `<defs><filter id="${name}" filterUnits="userSpaceOnUse" ${region} color-interpolation-filters="sRGB">${fill}<feComponentTransfer in="SourceGraphic" result="opaque"><feFuncA type="table" tableValues="1 1"/></feComponentTransfer><feBlend in="paint" in2="opaque" mode="${mode}" result="blend"/><feComposite in="blend" in2="SourceAlpha" operator="in"/></filter></defs><g filter="url(#${name})">${input.ink}</g>`,
      bounds: input.bounds,
    }
  }
  function reflection(effect, input) {
    const frame = geometryEffectFrame(effect, { ...settings, bounds: input.bounds })
    const name = id(),
      gradient = id(),
      filter = id()
    const [left, top, right, bottom] = frame.filterBounds
    const region = `x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"`
    const direction = ((effect.fadeDir ?? 5400000) * Math.PI) / 10800000
    const dx = Math.cos(direction),
      dy = Math.sin(direction)
    const length = Math.abs(dx) * (right - left) + Math.abs(dy) * (bottom - top)
    const cx = (left + right) / 2,
      cy = (top + bottom) / 2
    const stops = [
      [effect.stPos ?? 0, effect.stA ?? 100000],
      [effect.endPos ?? 100000, effect.endA ?? 0],
    ].sort((a, b) => a[0] - b[0])
    const mask = `<defs><linearGradient id="${gradient}" gradientUnits="userSpaceOnUse" x1="${cx - (dx * length) / 2}" y1="${cy - (dy * length) / 2}" x2="${cx + (dx * length) / 2}" y2="${cy + (dy * length) / 2}">${stops.map(([p, a]) => `<stop offset="${p / 100000}" stop-color="white" stop-opacity="${a / 100000}"/>`).join('')}</linearGradient><mask id="${name}" maskUnits="userSpaceOnUse" ${region} style="mask-type:alpha"><rect ${region} fill="url(#${gradient})"/></mask><filter id="${filter}" filterUnits="userSpaceOnUse" ${region} color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${frame.sigma}"/></filter></defs>`
    const reflected = {
      ink: `${mask}<g transform="matrix(${frame.inverse.join(' ')})"><g mask="url(#${name})"><g filter="url(#${filter})"><g transform="matrix(${frame.maskTransform.join(' ')})">${input.ink}</g></g></g></g>`,
      bounds: frame.bounds,
    }
    return merge(reflected, input)
  }
  function apply(effect, input, combined = false) {
    if (!input.bounds || !input.ink) return empty
    const args = { ...settings, ...input, includeSource: combined }
    let image
    if (effect.kind === 'outerShdw') image = geometryOuterShadowImage(geometry, effect, args)
    else if (effect.kind === 'prstShdw') {
      const tight = ['shdw19', 'shdw20'].includes(effect.prst)
      const anchorBounds = inkEnvelopes.get(input.ink)
      if (tight && anchorBounds === undefined)
        throw new TypeError('Source ink envelope is required for this preset shadow')
      image =
        tight && anchorBounds === null
          ? empty
          : merge(
              ...presetShadows(effect).map((shadow) =>
                geometryOuterShadowImage(geometry, shadow, {
                  ...args,
                  includeSource: false,
                  ...(tight ? { anchorBounds } : {}),
                })
              )
            )
      if (combined) image = merge(image, input)
    } else if (effect.kind === 'reflection') image = reflection(effect, input)
    else if (effect.kind === 'fillOverlay') image = overlay(effect, input)
    else {
      const painter = {
        glow: geometryGlowSvg,
        innerShdw: geometryInnerShadowSvg,
        blur: geometryBlurSvg,
        softEdge: geometrySoftEdgeSvg,
      }[effect.kind]
      const pad = ((effect.rad ?? 0) / 9525 / 3) * 4 + 1
      const grows =
        effect.rad > 0 &&
        (effect.kind === 'glow' || (effect.kind === 'blur' && effect.grow !== false))
      image = {
        ink: painter(geometry, effect, args),
        bounds: grows ? expand(input.bounds, pad) : input.bounds,
      }
    }
    return capture(image)
  }
  const inputs = new Map([['fillLine', capture(source)]])
  for (const [name, image] of Object.entries(settings.sourceImages ?? {}))
    inputs.set(name, capture(image))
  let output
  if (program.kind === 'list') {
    const byKind = Object.fromEntries(program.effects.map((effect) => [effect.kind, effect]))
    const optional = (kind, image, combined = false) =>
      byKind[kind] ? apply(byKind[kind], image, combined) : image
    // Keep the calibrated single-effect path byte-for-byte in its paint math.
    if (
      program.effects.length === 1 &&
      ['outerShdw', 'innerShdw', 'glow', 'softEdge', 'blur'].includes(program.effects[0].kind)
    ) {
      const bounds = apply(program.effects[0], inputs.get('fillLine'), true).bounds
      return { ink: geometrySingleEffectSvg(geometry, settings), bounds }
    }
    let combined = inputs.get('fillLine')
    if (byKind.fillOverlay || byKind.innerShdw) {
      if (inputs.has('fill') && inputs.has('line')) {
        const fill = optional('innerShdw', optional('fillOverlay', inputs.get('fill')), true)
        combined = capture(merge(fill, inputs.get('line')))
      } else throw new TypeError('Effect list requires separate fill and line source images')
    }
    const preset = byKind.prstShdw ? apply(byKind.prstShdw, combined) : empty
    const blurred = optional('blur', optional('softEdge', combined))
    const glow = byKind.glow ? apply(byKind.glow, blurred) : empty
    const halo = capture(merge(glow, blurred))
    const outer = byKind.outerShdw ? apply(byKind.outerShdw, halo) : empty
    output = optional('reflection', capture(merge(preset, outer, glow, blurred)))
  } else {
    const graph = compileGeometryEffectGraph(program),
      images = new Map()
    function evaluate(node) {
      if (images.has(node)) return images.get(node)
      let image
      if (node.kind === 'source') {
        if (!inputs.has(node.name)) throw new TypeError(`Missing effect source image: ${node.name}`)
        image = inputs.get(node.name)
      } else if (node.kind === 'reference') image = evaluate(graph.names.get(node.ref))
      else if (node.kind === 'container') image = evaluate(node.output)
      else if (node.kind === 'merge') image = capture(merge(...node.inputs.map(evaluate)))
      else image = apply(node.effect, evaluate(node.input))
      images.set(node, image)
      return image
    }
    output = evaluate(graph.root)
  }
  return { ink: `<defs>${definitions.join('')}</defs>${output.ink}`, bounds: output.bounds }
}
module.exports = { geometryEffectResult, presetShadows }
