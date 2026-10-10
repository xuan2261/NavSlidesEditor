const { z } = require('zod')
const { normalizeGameElement } = require('revealjs-shared')

function admitGameElement(element, ctx) {
  if (element.type !== 'game') return element
  let normalized
  try {
    normalized = normalizeGameElement(element)
  } catch (error) {
    const issues = error.errors?.length
      ? error.errors
      : [{ path: ['gameType'], message: error.message }]
    for (const issue of issues)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: issue.path, message: issue.message })
    return z.NEVER
  }
  return normalized
}

module.exports = { admitGameElement }
