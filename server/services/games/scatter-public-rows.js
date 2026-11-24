function scatterRows(room) {
  const state = room.domain,
    normalize = (text) => text.trim().normalize('NFC').toLowerCase().normalize('NFC')
  return [...room.scatterSubmissions.values()].flatMap((submission) =>
    submission.entries.map((entry) => {
      const normalized = normalize(entry.text),
        answers = Object.values(state.answers[entry.categoryId] || {})
      return {
        submissionId: submission.submissionId,
        teamId: submission.teamId,
        categoryId: entry.categoryId,
        text: entry.text,
        valid: state.validity?.[entry.categoryId]?.[submission.teamId] !== false,
        unique: answers.filter((text) => normalize(text) === normalized).length === 1,
        points: state.results[entry.categoryId]?.[submission.teamId] || 0,
      }
    })
  )
}
module.exports = { scatterRows }
