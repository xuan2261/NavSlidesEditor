function semanticGroupPaint(definition, instance) {
  const effects = instance.overrides.effects ?? definition.content.effects ?? {}
  if (
    !effects ||
    typeof effects !== 'object' ||
    Array.isArray(effects) ||
    Object.keys(effects).some((key) => key !== 'opacity')
  )
    throw new TypeError('Unsupported semantic group effect')
  const opacity = instance.overrides.opacity ?? definition.content.opacity ?? effects.opacity ?? 1
  if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1)
    throw new TypeError('Invalid semantic group opacity')
  return { opacity, composite: opacity !== 1 }
}

module.exports = { semanticGroupPaint }
