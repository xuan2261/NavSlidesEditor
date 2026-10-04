const { normalizeGameConfig } = require('./normalize-game-config.js')
const { validateGameConfig } = require('./game-schema.js')
const { throwInvalid } = require('./game-validation-utils.js')

function createSortingConfig(input) {
  const config = normalizeGameConfig({ gameType: 'sorting', sorting: input })
  throwInvalid(validateGameConfig('sorting', config).errors, 'Sorting configuration')
  return config
}

function sortingAssignmentConfig(config) {
  return {
    sourceIds: config.items.map((item) => item.id),
    targetIds: config.buckets.map((bucket) => bucket.id),
    bijection: false,
  }
}

// Sorting is many-to-one; quiz matching's sole bijection evaluator is intentionally not used here.
function evaluateSortingAnswer(config, answer) {
  const invalid = (error) => ({ valid: false, correct: false, error })
  const assignments = answer?.assignments
  if (!Array.isArray(assignments) || assignments.length !== config.items.length)
    return invalid('Assign every item before submitting.')
  const sourceIds = new Set(config.items.map((item) => item.id)),
    targetIds = new Set(config.buckets.map((bucket) => bucket.id))
  const submitted = new Map()
  for (const row of assignments) {
    if (!row || !sourceIds.has(row.itemId) || !targetIds.has(row.bucketId))
      return invalid('Unknown item or bucket ID.')
    if (submitted.has(row.itemId)) return invalid('Each item must have exactly one assignment.')
    submitted.set(row.itemId, row.bucketId)
  }
  return {
    valid: true,
    correct: config.answerKey.assignments.every(
      (row) => submitted.get(row.itemId) === row.bucketId
    ),
    error: null,
  }
}

module.exports = { createSortingConfig, sortingAssignmentConfig, evaluateSortingAnswer }
