// Sparse edit intent refers to the current provider, never copied source paint.
const { isGeometryColorTransform, resolveGeometryColorPaint } = require('./pptx-geometry-color')
const { gradientColors } = require('./pptx-geometry-gradient')
const { gradientRectangle } = require('./pptx-geometry-gradient-parameters')
function fail(reason) {
  throw new TypeError('Invalid PPTX gradient edit: ' + reason)
}
function fields(value, allowed, required = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return !allowed.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')
    }) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    fail('record fields')
}
function array(value, min, max) {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length < min ||
    value.length > max ||
    Reflect.ownKeys(value).length !== value.length + 1 ||
    Reflect.ownKeys(value).some((key) => {
      if (key === 'length') return false
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return (
        typeof key !== 'string' ||
        !/^(0|[1-9]\d*)$/.test(key) ||
        Number(key) >= value.length ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      )
    })
  )
    fail('array fields')
}
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max
const localKey = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256
function baseColor(value) {
  fields(value, ['kind', 'value'], ['kind', 'value'])
  resolveGeometryColorPaint(value)
}
function gradientPatch(patch) {
  fields(patch, ['angle', 'scaled', 'path', 'fillToRect', 'tileRect', 'stops'])
  if ('angle' in patch && !integer(patch.angle, 21599999)) fail('angle')
  if ('scaled' in patch && typeof patch.scaled !== 'boolean') fail('scaled')
  if ('path' in patch && !['circle', 'rect', 'shape'].includes(patch.path)) fail('path')
  for (const key of ['fillToRect', 'tileRect'])
    if (Object.hasOwn(patch, key)) gradientRectangle(patch[key])
  if (patch.stops !== undefined) {
    fields(patch.stops, ['provider', 'entries'], ['provider', 'entries'])
    const { provider, entries } = patch.stops
    fields(
      provider,
      ['instanceId', 'declarationKey', 'topology'],
      ['instanceId', 'declarationKey', 'topology']
    )
    array(provider.topology, 2, 256)
    for (const transforms of provider.topology) array(transforms, 0, 32)
    if (
      typeof provider.instanceId !== 'string' ||
      !provider.instanceId ||
      provider.instanceId.length > 1024 ||
      typeof provider.declarationKey !== 'string' ||
      !provider.declarationKey ||
      provider.declarationKey.length > 1048576 ||
      !Array.isArray(provider.topology) ||
      provider.topology.length < 2 ||
      provider.topology.length > 256 ||
      provider.topology.some(
        (list) =>
          !Array.isArray(list) ||
          list.length > 32 ||
          list.some((kind) => typeof kind !== 'string' || !kind || kind.length > 32)
      )
    )
      fail('provider reference')
    array(entries, 2, 256)
    for (const entry of entries) {
      fields(
        entry,
        ['from', 'key', 'pos', 'color', 'transforms'],
        'from' in entry ? ['from'] : ['key', 'pos', 'color']
      )
      if ('key' in entry && !localKey(entry.key)) fail('stop key')
      if ('from' in entry && !integer(entry.from, 255)) fail('stop reference')
      if ('pos' in entry && !integer(entry.pos, 100000)) fail('position')
      if (entry.color !== undefined) baseColor(entry.color)
      if (entry.transforms !== undefined) {
        array(entry.transforms, 0, 32)
        for (const transform of entry.transforms) {
          fields(
            transform,
            Object.hasOwn(transform, 'from') ? ['from', 'key', 'value'] : ['key', 'kind', 'value'],
            Object.hasOwn(transform, 'from') ? ['from'] : ['key', 'kind', 'value']
          )
          if ('key' in transform && !localKey(transform.key)) fail('transform key')
          if ('from' in transform) {
            if (
              !('from' in entry) ||
              !integer(transform.from, 31) ||
              ('value' in transform && !Number.isSafeInteger(transform.value))
            )
              fail('transform reference')
          } else if (!isGeometryColorTransform({ kind: transform.kind, value: transform.value }))
            fail('transform')
        }
      }
    }
  }
  return patch
}
function gradientProvider(binding) {
  return {
    instanceId: binding.instanceId,
    declarationKey: JSON.stringify([
      binding.sourceKey,
      binding.stops.map((stop) => [stop.origin, stop.transformOrigins]),
    ]),
    topology: binding.stops.map((stop) =>
      (stop.color.transforms ?? []).map((transform) => transform.kind)
    ),
  }
}
function mergeGradientPatch(previous, patch) {
  const merged = { ...previous, ...patch }
  for (const key of ['fillToRect', 'tileRect'])
    if (Object.hasOwn(patch, key)) merged[key] = { ...previous?.[key], ...patch[key] }
  return merged
}
function bindGradient(gradient, sourceKey, instanceId, resolveColor) {
  const { stops, ...parameters } = gradient
  return {
    sourceKey,
    instanceId,
    parameters: {
      ...parameters,
      ...(parameters.kind === 'path' && !Object.hasOwn(parameters, 'path')
        ? { path: 'shape' }
        : {}),
    },
    stops: stops.map((stop, index) => ({
      pos: stop.pos,
      color: structuredClone(stop.color),
      resolveColor,
      origin: index,
      transformOrigins: (stop.color.transforms ?? []).map((_, i) => i),
    })),
  }
}
function applyGradientPatch(binding, patch, instanceId, resolveColor) {
  gradientPatch(patch)
  if (!binding) fail('missing gradient provider')
  let stops = binding.stops
  if (patch.stops) {
    const expected = gradientProvider(binding),
      actual = patch.stops.provider
    if (
      actual.instanceId !== expected.instanceId ||
      actual.declarationKey !== expected.declarationKey ||
      JSON.stringify(actual.topology) !== JSON.stringify(expected.topology)
    ) {
      fail('gradient provider topology changed')
    }
    stops = patch.stops.entries.map((entry) => {
      const previous = Object.hasOwn(entry, 'from') ? binding.stops[entry.from] : undefined
      if (Object.hasOwn(entry, 'from') && !previous) fail('missing stop reference')
      const transforms =
        entry.transforms === undefined
          ? previous?.color.transforms
          : entry.transforms.map((transform) => {
              if (!Object.hasOwn(transform, 'from'))
                return { kind: transform.kind, value: transform.value }
              const original = previous?.color.transforms?.[transform.from]
              if (!original) fail('missing transform reference')
              const next = {
                ...original,
                ...('value' in transform ? { value: transform.value } : {}),
              }
              if (!isGeometryColorTransform(next)) fail('transform value')
              return next
            })
      const color = { ...(entry.color ?? previous?.color) }
      delete color.transforms
      if (transforms?.length) color.transforms = structuredClone(transforms)
      return {
        pos: entry.pos ?? previous.pos,
        color,
        resolveColor: entry.color ? resolveColor : previous.resolveColor,
        origin: entry.key ? { instanceId, key: entry.key } : previous.origin,
        transformOrigins:
          entry.transforms === undefined
            ? (previous?.transformOrigins ?? [])
            : entry.transforms.map((transform) =>
                transform.key
                  ? { instanceId, key: transform.key }
                  : Object.hasOwn(transform, 'from')
                    ? previous.transformOrigins[transform.from]
                    : undefined
              ),
      }
    })
    if (
      new Set(stops.map((stop) => JSON.stringify(stop.origin))).size !== stops.length ||
      stops.some(
        (stop) =>
          new Set(stop.transformOrigins.map((origin) => JSON.stringify(origin))).size !==
          stop.transformOrigins.length
      )
    )
      fail('ambiguous output identity')
  }
  const parameters = {
    ...binding.parameters,
    ...Object.fromEntries(
      ['angle', 'scaled', 'path']
        .filter((key) => Object.hasOwn(patch, key))
        .map((key) => [key, patch[key]])
    ),
  }
  for (const key of ['fillToRect', 'tileRect'])
    if (Object.hasOwn(patch, key))
      parameters[key] = {
        ...(binding.parameters[key] ??
          (key === 'fillToRect' ? { l: 50000, t: 50000, r: 50000, b: 50000 } : {})),
        ...patch[key],
      }
  return { ...binding, parameters, stops }
}
function gradientBindingPaint(binding) {
  const gradient = {
    // Replay the source reader's parameter layout, not JSON map insertion order.
    ...Object.fromEntries(
      ['kind', 'angle', 'scaled', 'path', 'fillToRect', 'rotWithShape', 'flip', 'tileRect']
        .filter((key) => Object.hasOwn(binding.parameters, key))
        .map((key) => [
          key,
          ['fillToRect', 'tileRect'].includes(key)
            ? Object.fromEntries(
                ['l', 't', 'r', 'b']
                  .filter((side) => Object.hasOwn(binding.parameters[key], side))
                  .map((side) => [side, binding.parameters[key][side]])
              )
            : binding.parameters[key],
        ])
    ),
    stops: binding.stops.map((stop) => ({
      pos: stop.pos,
      color: stop.resolveColor(stop.color),
    })),
  }
  gradientColors(gradient)
  return gradient
}
function gradientEditState(base, binding, patch, gradient) {
  return {
    provider: gradientProvider(base),
    entries: structuredClone(patch?.stops?.entries ?? base.stops.map((_, from) => ({ from }))),
    providerTransforms: base.stops.map((stop) => structuredClone(stop.color.transforms ?? [])),
    gradient: {
      ...gradient,
      stops: gradient.stops.map((stop, index) => {
        const color = { ...stop.color }
        delete color.transforms
        if (binding.stops[index].color.transforms?.length)
          color.transforms = structuredClone(binding.stops[index].color.transforms)
        return { ...stop, color }
      }),
    },
  }
}
module.exports = {
  gradientPatch,
  mergeGradientPatch,
  bindGradient,
  applyGradientPatch,
  gradientBindingPaint,
  gradientEditState,
}
