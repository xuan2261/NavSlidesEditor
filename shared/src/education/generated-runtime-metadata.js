const { normalizeInteractionVariables } = require('./interaction-variables.js')
const { serializeEducationConfig } = require('./config-serialization.js')

function generatedRuntimeMetadata(presentation) {
  const { variables, error } = normalizeInteractionVariables(presentation.interactionVariables)
  if (error) throw new TypeError(error)
  let hasPlugins = false,
    hasInitialVisibility = false
  for (const slide of presentation.slides || []) {
    for (const current of [slide, ...(slide.children || [])]) {
      for (const element of current.elements || []) {
        if (element.type?.startsWith('plugin:')) hasPlugins = true
        if (element.initialVisibility === 'hidden') hasInitialVisibility = true
      }
    }
  }
  return { hasPlugins, hasInitialVisibility, variablesJson: serializeEducationConfig(variables) }
}
module.exports = { generatedRuntimeMetadata }
