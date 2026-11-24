export const JEOPARDY_POINTS = [100, 200, 300, 400, 500]

// Canonical question identity is also the board-cell identity.
export function buildQuestionLookup(element) {
  const lookup = {}
  for (const category of element.categories || []) {
    for (const question of category.questions || []) lookup[question.id] = question
  }
  return lookup
}

export function getBoardPoints(element) {
  const values = [
    ...new Set(
      (element.categories || []).flatMap((category) =>
        category.questions.map((question) => question.points)
      )
    ),
  ]
  return values.length ? values.sort((a, b) => a - b) : JEOPARDY_POINTS
}

// Which cells are Daily Double (by key string)
export function getDailyDoubleKeys(element) {
  const dd = element.dailyDouble || []
  return new Set(Array.isArray(dd) ? dd : [])
}
