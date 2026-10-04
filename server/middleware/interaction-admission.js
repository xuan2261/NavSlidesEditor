const { z } = require('zod')
const { normalizeElementAction, normalizePresentationGames } = require('revealjs-shared')
const {
  normalizeInteractionVariables,
} = require('revealjs-shared/src/education/interaction-variables.js')

const interactionVariablesSchema = z.unknown().transform((value, ctx) => {
  const { variables, error } = normalizeInteractionVariables(value)
  if (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
    return z.NEVER
  }
  return variables
})
const elementActionSchema = z.unknown().transform((value, ctx) => {
  const { action, error } = normalizeElementAction(value)
  if (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error })
    return z.NEVER
  }
  return action
})
function admitPresentationInteractions(presentation, ctx) {
  try {
    return normalizePresentationGames(presentation)
  } catch (error) {
    for (const issue of error.errors || [{ path: [], message: error.message }])
      ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue })
    return z.NEVER
  }
}
module.exports = { interactionVariablesSchema, elementActionSchema, admitPresentationInteractions }
