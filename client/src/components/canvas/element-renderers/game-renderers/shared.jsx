// Shared bits for the game renderers: lazy interactive-module getters,
// small presentational fallbacks.
// (split from game-element-renderer.jsx)
// Phase 10: Interactive sub-renderers (lazy-loaded via dynamic import for ESM compatibility)
let _FourCornersP, _RelayRaceP, _TriviaChampP, _ScattergoriesP, _NamePickerP
export const getNamePickerInteractiveP = () => {
  if (!_NamePickerP)
    _NamePickerP = import('../game-interactive/name-picker-interactive-game-renderer.jsx').then(
      (m) => m.NamePickerRenderer
    )
  return _NamePickerP
}
export const getFourCornersInteractiveP = () => {
  if (!_FourCornersP)
    _FourCornersP =
      import('../game-interactive/four-corners-live-game-renderer-with-timer-scoring-leaderboard.jsx').then(
        (m) => m.FourCornersRenderer
      )
  return _FourCornersP
}
export const getRelayRaceInteractiveP = () => {
  if (!_RelayRaceP)
    _RelayRaceP =
      import('../game-interactive/relay-race-live-game-renderer-with-team-lanes-baton-pass.jsx').then(
        (m) => m.RelayRaceRenderer
      )
  return _RelayRaceP
}
export const getTriviaChampInteractiveP = () => {
  if (!_TriviaChampP)
    _TriviaChampP =
      import('../game-interactive/trivia-championship-live-game-renderer-with-round-tabs-lightning-jackpot.jsx').then(
        (m) => m.TriviaChampRenderer
      )
  return _TriviaChampP
}
export const getScattergoriesInteractiveP = () => {
  if (!_ScattergoriesP)
    _ScattergoriesP =
      import('../game-interactive/scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring.jsx').then(
        (m) => m.ScattergoriesRenderer
      )
  return _ScattergoriesP
}

export const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: 'rgba(255,255,255,0.5)',
      fontSize: 12,
    }}
  >
    Loading game…
  </div>
)
export const ConnectionError = ({ message }) =>
  message ? (
    <div role="alert" style={{ color: '#fecaca', fontSize: 10, textAlign: 'center' }}>
      Game connection failed: {message}
    </div>
  ) : null

export function getCanonicalAnswerText(question) {
  if (!question) return ''
  const key = question.answerKey
  const text = (options, id) => {
    const option = options.find((candidate) => candidate.id === id)
    return option.text || option.media?.alt || ''
  }
  switch (question.kind) {
    case 'single-choice':
      return text(question.options, key.optionId)
    case 'multi-choice':
      return key.optionIds.map((id) => text(question.options, id)).join(', ')
    case 'true-false':
      return key.value ? 'True' : 'False'
    case 'fill-blank':
      return key.accepted.join(', ')
    case 'ordering':
      return key.itemIds.map((id) => text(question.options, id)).join(' → ')
    case 'matching':
      return key.pairs
        .map(
          (pair) =>
            `${text(question.options.left, pair.leftId)} → ${text(question.options.right, pair.rightId)}`
        )
        .join(', ')
    case 'image-hotspot':
      return key.regions.map((region) => text(question.options, region.id)).join(', ')
    default:
      throw new Error(`Unsupported canonical question kind: ${question.kind}`)
  }
}
