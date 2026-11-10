const { semanticStyle, semanticStyles, semanticInstances } = require('./pptx-semantic-records.js')

function overlayBlips(program, visit, wrapped = false) {
  const unwrap = (value) => (wrapped ? value?.value : value)
  for (const field of program?.effects ?? []) {
    const effect = unwrap(field)
    if (effect.kind === 'cont') overlayBlips(effect, visit, wrapped)
    if (effect.kind === 'fillOverlay') {
      const blip = unwrap(unwrap(effect.fill)?.blip)
      if (blip) visit(blip)
    }
  }
}
function validateSourceOverlayBindings(document) {
  if (document.schemaVersion !== 2 && document.schemaVersion !== 3) return
  function bindingFor(blip, embed) {
    const binding = semanticStyle(document, blip.bindingId) ?? document.styles?.[blip.bindingId]
    if (
      binding?.kind !== 'geometry-blip-binding' ||
      binding.origin !== 'source' ||
      binding.payload.edge.relationshipId !== embed
    )
      throw new TypeError('Invalid source overlay blip binding identity')
    return binding
  }
  for (const [, entry] of semanticStyles(document, (entry) => entry.origin === 'source' && entry.kind !== 'text-context' && entry.kind !== 'text-context-resources')) {
    if (entry.origin !== 'source') continue
    const format =
      entry.kind === 'native-theme-override' ? entry.payload.formatScheme?.value : entry.payload
    const programs = [
      entry.payload.properties?.effects,
      entry.payload.hiddenEffects?.value.effects,
      ...(format?.effectStyles ?? []).map((field) => field.value.effects),
    ]
    for (const program of programs) {
      overlayBlips(
        program?.value,
        (blip) => {
          const binding = bindingFor(blip, blip.embed.value)
          const source = blip.embed.source
          if (
            binding.source.partUri !== source.partUri ||
            binding.source.preconditionHash !== source.preconditionHash ||
            binding.source.componentLocator.preconditionHash !==
              source.componentLocator.preconditionHash ||
            JSON.stringify(binding.source.componentLocator.path) !==
              JSON.stringify(source.componentLocator.path)
          )
            throw new TypeError('Invalid source overlay blip binding identity')
        },
        true
      )
    }
  }
  for (const [, instance] of semanticInstances(document)) {
    for (const override of Object.values(instance.overrides.components ?? {})) {
      overlayBlips(override.geometryStyle?.effects, (blip) => bindingFor(blip, blip.embed))
    }
  }
}
module.exports = { overlayBlips, validateSourceOverlayBindings }
