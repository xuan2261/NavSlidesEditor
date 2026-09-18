// Shared bits for the game renderers: lazy interactive-module getters,
// small presentational fallbacks, and the game-type label map.
// (split from game-element-renderer.jsx)
// Phase 10: Interactive sub-renderers (lazy-loaded via dynamic import for ESM compatibility)
let _FourCornersP, _RelayRaceP, _TriviaChampP, _ScattergoriesP, _NamePickerP
export const getNamePickerInteractiveP = () => {
  if (!_NamePickerP) _NamePickerP = import('../game-interactive/name-picker-interactive-game-renderer.jsx').then(m => m.NamePickerRenderer)
  return _NamePickerP
}
export const getFourCornersInteractiveP = () => {
  if (!_FourCornersP) _FourCornersP = import('../game-interactive/four-corners-live-game-renderer-with-timer-scoring-leaderboard.jsx').then(m => m.FourCornersRenderer)
  return _FourCornersP
}
export const getRelayRaceInteractiveP = () => {
  if (!_RelayRaceP) _RelayRaceP = import('../game-interactive/relay-race-live-game-renderer-with-team-lanes-baton-pass.jsx').then(m => m.RelayRaceRenderer)
  return _RelayRaceP
}
export const getTriviaChampInteractiveP = () => {
  if (!_TriviaChampP) _TriviaChampP = import('../game-interactive/trivia-championship-live-game-renderer-with-round-tabs-lightning-jackpot.jsx').then(m => m.TriviaChampRenderer)
  return _TriviaChampP
}
export const getScattergoriesInteractiveP = () => {
  if (!_ScattergoriesP) _ScattergoriesP = import('../game-interactive/scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring.jsx').then(m => m.ScattergoriesRenderer)
  return _ScattergoriesP
}

export const LoadingFallback = () => (
  <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'rgba(255,255,255,0.5)',fontSize:12 }}>Loading game…</div>
)
export const ConnectionError = ({ message }) => message ? (
  <div role="alert" style={{ color: '#fecaca', fontSize: 10, textAlign: 'center' }}>
    Game connection failed: {message}
  </div>
) : null

export const GAME_TYPE_LABELS = {
  'name-picker': 'Name Picker',
  'hot-potato': 'Hot Potato Quiz',
  'jeopardy': 'Jeopardy',
  'four-corners': 'Four Corners',
  'relay-race': 'Relay Race',
  'trivia-champ': 'Trivia Championship',
  'scattergories': 'Scattergories',
  'poll': 'Live Poll',
  'word-cloud': 'Word Cloud',
  'matching': 'Matching',
}
