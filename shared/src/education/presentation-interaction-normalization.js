const { normalizeInteractionVariables } = require('./interaction-variables.js')
const { normalizeElementAction } = require('../element-actions.js')
const { throwInvalid } = require('./game-validation-utils.js')

function normalizePresentationInteractions(presentation, { validate = true } = {}) {
  const errors = []
  const result = { ...presentation }
  // Values belong to the mounted runtime store, never the authored declaration.
  for (const key of ['interactionValues', 'interactionVariableValues', 'interactionState'])
    delete result[key]
  const declaration = normalizeInteractionVariables(presentation.interactionVariables)
  if (declaration.error) errors.push({ path: ['interactionVariables'], message: declaration.error })
  else if (presentation.interactionVariables !== undefined)
    result.interactionVariables = declaration.variables
  const ids = new Set((declaration.variables || []).map((variable) => variable.id))
  const normalizeElement = (element, path) => {
    if (!element || typeof element !== 'object') return element
    const copy = { ...element }
    if (
      element.initialVisibility !== undefined &&
      !['visible', 'hidden'].includes(element.initialVisibility)
    ) {
      errors.push({
        path: [...path, 'initialVisibility'],
        message: 'Initial visibility must be visible or hidden.',
      })
    }
    if (element.action != null) {
      const normalized = normalizeElementAction(element.action)
      if (normalized.error) errors.push({ path: [...path, 'action'], message: normalized.error })
      else copy.action = normalized.action
      if (
        validate &&
        ['score-add', 'score-subtract'].includes(normalized.action?.kind) &&
        !ids.has(normalized.action.variableId)
      ) {
        errors.push({
          path: [...path, 'action', 'variableId'],
          message: 'Choose a declared interaction variable.',
        })
      }
    }
    if (validate && Array.isArray(element.scoreboard?.teams))
      element.scoreboard.teams.forEach((team, index) => {
        if (team?.variableId !== undefined && !ids.has(team.variableId))
          errors.push({
            path: [...path, 'scoreboard', 'teams', index, 'variableId'],
            message: 'Choose a declared interaction variable.',
          })
      })
    return copy
  }
  const normalizeElements = (elements, path) =>
    Array.isArray(elements)
      ? elements.map((element, index) => normalizeElement(element, [...path, index]))
      : elements
  const visit = (slides, path) =>
    Array.isArray(slides)
      ? slides.map((slide, index) => {
          const here = [...path, index]
          const patches = slide.layoutOverrides?.elementPatches
          return {
            ...slide,
            ...(Array.isArray(slide.elements)
              ? { elements: normalizeElements(slide.elements, [...here, 'elements']) }
              : {}),
            ...(Array.isArray(slide.children)
              ? { children: visit(slide.children, [...here, 'children']) }
              : {}),
            ...(patches
              ? {
                  layoutOverrides: {
                    ...slide.layoutOverrides,
                    elementPatches: Object.fromEntries(
                      Object.entries(patches).map(([id, patch]) => [
                        id,
                        normalizeElement(patch, [...here, 'layoutOverrides', 'elementPatches', id]),
                      ])
                    ),
                  },
                }
              : {}),
          }
        })
      : slides
  if (Array.isArray(presentation.slides)) result.slides = visit(presentation.slides, ['slides'])
  if (Array.isArray(presentation.layoutMasters))
    result.layoutMasters = presentation.layoutMasters.map((master, index) => ({
      ...master,
      fixedElements: normalizeElements(master.fixedElements, [
        'layoutMasters',
        index,
        'fixedElements',
      ]),
    }))
  throwInvalid(errors, 'Presentation interactions')
  return result
}

module.exports = { normalizePresentationInteractions }
