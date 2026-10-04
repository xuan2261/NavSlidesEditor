const { node } = require('./dom.js')
const { renderReveal } = require('./live-player-form.js')
function createLiveJeopardyCard({ root }) {
  const document = root.ownerDocument,
    title = node(document, 'h2'),
    clue = node(document, 'p'),
    active = node(document, 'p')
  const media = node(document, 'div'),
    cells = node(document, 'ul'),
    reveal = node(document, 'div')
  root.append(title, clue, active, media, cells, reveal)
  return {
    render(state) {
      title.textContent =
        state.question?.prompt || 'Jeopardy — waiting for the host to choose a clue'
      const board = state.jeopardy,
        cell = board?.cells?.find((cell) => cell.cellId === board.activeCellId)
      clue.textContent = cell
        ? `${cell.categoryId} · ${cell.points} points${board.isDailyDouble ? ` · Daily Double wager: ${board.wager ?? 'waiting'}` : ''}`
        : ''
      active.textContent = `Active team: ${state.teams?.find((team) => team.id === state.turn?.activeTeamId)?.name || state.turn?.activeTeamId || 'waiting'}. The host records spoken answers.`
      media.replaceChildren()
      if (state.question?.media) {
        const image = node(document, 'img', undefined, state.question.media)
        image.style.maxWidth = '100%'
        media.append(image)
      }
      cells.replaceChildren()
      for (const row of board?.cells || [])
        cells.append(
          node(
            document,
            'li',
            `${row.categoryId} · ${row.points} — ${row.used ? 'used' : 'available'}`
          )
        )
      renderReveal(reveal, state)
    },
  }
}
module.exports = { createLiveJeopardyCard }
