
export const JEOPARDY_POINTS = [100, 200, 300, 400, 500]

// Build flat question lookup: { "catIdx-pointValue": questionObj }
export function buildQuestionLookup(element) {
  const lookup = {}
  const cats = element.categories || []
  cats.forEach((cat, catIdx) => {
    const qs = cat.questions || []
    JEOPARDY_POINTS.forEach(pts => {
      const key = `${catIdx}-${pts}`
      const found = qs.find(q => q.points === pts)
      lookup[key] = found || null
    })
  })
  return lookup
}

// Which cells are Daily Double (by key string)
export function getDailyDoubleKeys(element) {
  const dd = element.dailyDouble || []
  return new Set(Array.isArray(dd) ? dd : [])
}
