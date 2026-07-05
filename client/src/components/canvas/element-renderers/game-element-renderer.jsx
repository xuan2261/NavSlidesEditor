/**
 * Game Element Renderer — Phase 3 full implementation + Phase 10 interactive games.
 *
 * Factory that dispatches to per-game-type sub-renderers.
 * Compatible with renderToString (hooks only in lazy-loaded interactive sub-modules).
 *
 * Supports all game types from GAME_TYPES.
 *
 * Renders in two modes:
 *  - Edit mode  (isPresenting !== true): preview card with setup label
 *  - Present mode (isPresenting === true): live game UI with controls
 */
import React from 'react'
import { useGameSocket } from '../../../hooks/use-game-socket.js'
 

// Phase 10: Interactive sub-renderers (lazy-loaded via dynamic import for ESM compatibility)
let _FourCornersP, _RelayRaceP, _TriviaChampP, _ScattergoriesP, _NamePickerP
const getNamePickerInteractiveP = () => {
  if (!_NamePickerP) _NamePickerP = import('./game-interactive/name-picker-interactive-game-renderer.jsx').then(m => m.NamePickerRenderer)
  return _NamePickerP
}
const getFourCornersInteractiveP = () => {
  if (!_FourCornersP) _FourCornersP = import('./game-interactive/four-corners-live-game-renderer-with-timer-scoring-leaderboard.jsx').then(m => m.FourCornersRenderer)
  return _FourCornersP
}
const getRelayRaceInteractiveP = () => {
  if (!_RelayRaceP) _RelayRaceP = import('./game-interactive/relay-race-live-game-renderer-with-team-lanes-baton-pass.jsx').then(m => m.RelayRaceRenderer)
  return _RelayRaceP
}
const getTriviaChampInteractiveP = () => {
  if (!_TriviaChampP) _TriviaChampP = import('./game-interactive/trivia-championship-live-game-renderer-with-round-tabs-lightning-jackpot.jsx').then(m => m.TriviaChampRenderer)
  return _TriviaChampP
}
const getScattergoriesInteractiveP = () => {
  if (!_ScattergoriesP) _ScattergoriesP = import('./game-interactive/scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring.jsx').then(m => m.ScattergoriesRenderer)
  return _ScattergoriesP
}
const LoadingFallback = () => (
  <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'rgba(255,255,255,0.5)',fontSize:12 }}>Loading game…</div>
)

// ---------------------------------------------------------------------------
// Game type labels
// ---------------------------------------------------------------------------
const GAME_TYPE_LABELS = {
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

// ---------------------------------------------------------------------------
// Wheel renderer (name-picker wheel mode)
// ---------------------------------------------------------------------------
function WheelRenderer({ element }) {
  const colors = element.wheelColors && element.wheelColors.length > 0
    ? element.wheelColors
    : ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#FF9800', '#795548']
  const segments = element.wheelSegments || 8
  const items = element.items || []
  const svgR = 70
  const cx = 90
  const cy = 90
  const radPerSeg = (2 * Math.PI) / segments
  const pointerH = 18

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', height: '100%' }}>
      <svg width="180" height="196" viewBox="0 0 180 196" style={{ overflow: 'visible' }}>
        {/* Wheel body */}
        <circle cx={cx} cy={cy} r={svgR} fill="none" stroke={element.accentColor || '#6366f1'} strokeWidth="2" />
        {/* Segments */}
        {Array.from({ length: segments }).map((_, i) => {
          const startAngle = i * radPerSeg - Math.PI / 2
          const endAngle = startAngle + radPerSeg
          const x1 = cx + svgR * Math.cos(startAngle)
          const y1 = cy + svgR * Math.sin(startAngle)
          const x2 = cx + svgR * Math.cos(endAngle)
          const y2 = cy + svgR * Math.sin(endAngle)
          const fill = colors[i % colors.length]
          return (
            <path
              key={i}
              d={`M${cx},${cy} L${x1},${y1} A${svgR},${svgR} 0 0,1 ${x2},${y2} Z`}
              fill={fill}
              opacity="0.85"
            />
          )
        })}
        <circle cx={cx} cy={cy} r="14" fill={element.backgroundColor || '#1a1a2e'} />
        <circle cx={cx} cy={cy} r="14" fill="none" stroke={element.accentColor || '#6366f1'} strokeWidth="2" />
        {/* Pointer triangle */}
        <polygon
          points={`${cx},${cy - svgR - 2} ${cx - 7},${cy - svgR + pointerH} ${cx + 7},${cy - svgR + pointerH}`}
          fill={element.accentColor || '#6366f1'}
        />
        {/* Items label on wheel (show first 3 as text) */}
        {items.slice(0, 3).map((item, i) => {
          const angle = (i * 2 * Math.PI) / Math.min(items.length, 3) - Math.PI / 2
          const tx = cx + (svgR * 0.55) * Math.cos(angle)
          const ty = cy + (svgR * 0.55) * Math.sin(angle)
          return (
            <text
              key={i}
              x={tx}
              y={ty}
              fill="white"
              fontSize="8"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: 'sans-serif', fontWeight: 'bold', pointerEvents: 'none' }}
            >
              {String(item).slice(0, 6)}
            </text>
          )
        })}
      </svg>
      {items.length > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', maxWidth: 160, textAlign: 'center' }}>
          {items.length} items — {items.slice(0, 2).join(', ')}{items.length > 2 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dice renderer (name-picker dice mode)
// ---------------------------------------------------------------------------
function DiceRenderer({ element }) {
  const diceCount = element.diceCount || 2
  const _face = 6
  const diceSize = 28
  const gap = 8

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', gap, alignItems: 'center' }}>
        {Array.from({ length: diceCount }).map((_, i) => (
          <svg key={i} width={diceSize} height={diceSize} viewBox="0 0 28 28">
            <rect x="1" y="1" width="26" height="26" rx="4" fill={element.accentColor || '#6366f1'} />
            {/* Pip pattern for 5 */}
            <circle cx="7" cy="7" r="2.5" fill="white" />
            <circle cx="14" cy="14" r="2.5" fill="white" />
            <circle cx="21" cy="21" r="2.5" fill="white" />
            <circle cx="21" cy="7" r="2.5" fill="white" />
            <circle cx="7" cy="21" r="2.5" fill="white" />
          </svg>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
        {diceCount} Dice — {element.pickerMode || 'dice'} mode
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Name Picker renderer
// ---------------------------------------------------------------------------
function NamePickerRenderer({ element, _isPresenting }) {
  const mode = element.pickerMode || 'wheel'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      {mode === 'wheel' && <WheelRenderer element={element} />}
      {mode === 'dice' && <DiceRenderer element={element} />}
      {mode === 'button' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 32, color: element.accentColor || '#6366f1' }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="30" fill={element.accentColor || '#6366f1'} opacity="0.2" />
              <circle cx="32" cy="32" r="22" fill={element.accentColor || '#6366f1'} opacity="0.4" />
              <circle cx="32" cy="32" r="14" fill={element.accentColor || '#6366f1'} />
              <text x="32" y="38" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>
                {element.items && element.items.length > 0 ? '?' : '!'}
              </text>
            </svg>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            Button — {element.items ? `${element.items.length} choices` : 'no items'}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hot Potato renderer
// ---------------------------------------------------------------------------
function HotPotatoRenderer({ element, _isPresenting }) {
  const question = element.questions && element.questions[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🔥</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>{element.title || 'Hot Potato Quiz'}</div>
      {question && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', padding: '0 16px', maxWidth: 300 }}>
          {question.question}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
        {element.questions ? `${element.questions.length} question${element.questions.length !== 1 ? 's' : ''}` : 'No questions'}
      </div>
    </div>
  )
}

function PollRenderer({ element, isPresenting }) {
  const pollConfig = element.poll || element
  const options = React.useMemo(
    () => (Array.isArray(pollConfig.options) ? pollConfig.options : []),
    [pollConfig.options]
  )
  const socketOptions = React.useMemo(() => ({
    gameType: 'poll',
    options: {
      prompt: pollConfig.prompt || 'Live Poll',
      options,
    },
  }), [pollConfig.prompt, options])
  const socketResult = useGameSocket(
    isPresenting ? element.id || 'poll' : null,
    isPresenting ? 'presenter' : null,
    'host',
    socketOptions
  )
  const { emit, gameState, isConnected } = socketResult
  const aggregateOptions = gameState?.options || options.map(option => ({ ...option, votes: 0 }))
  const totalVotes = gameState?.totalVotes || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 360 }}>
      <div style={{ fontSize: 15, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
        {pollConfig.prompt || 'Live Poll'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {aggregateOptions.map((option) => {
          const pct = totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0
          return (
            <div key={option.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                <span>{option.text}</span>
                <span>{option.votes || 0} · {pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: element.accentColor || '#6366f1' }} />
              </div>
            </div>
          )
        })}
      </div>
      {isPresenting && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => emit?.('game-poll-start', { gameId: element.id || 'poll' })}
            style={{ background: element.accentColor || '#6366f1', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            {isConnected ? 'Start poll' : 'Connecting…'}
          </button>
          <button
            onClick={() => emit?.('game-poll-reveal', { gameId: element.id || 'poll' })}
            style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Refresh
          </button>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · anonymous aggregate
      </div>
    </div>
  )
}

function WordCloudRenderer({ element, isPresenting }) {
  const cloudConfig = element['word-cloud'] || element
  const socketOptions = React.useMemo(() => ({
    gameType: 'word-cloud',
    options: {
      prompt: cloudConfig.prompt || 'Word Cloud',
      maxPhraseLength: cloudConfig.maxPhraseLength || 40,
      maxSubmissionsPerPlayer: cloudConfig.maxSubmissionsPerPlayer || 5,
      displayLimit: cloudConfig.displayLimit || 50,
    },
  }), [
    cloudConfig.displayLimit,
    cloudConfig.maxPhraseLength,
    cloudConfig.maxSubmissionsPerPlayer,
    cloudConfig.prompt,
  ])
  const socketResult = useGameSocket(
    isPresenting ? element.id || 'word-cloud' : null,
    isPresenting ? 'presenter' : null,
    'host',
    socketOptions
  )
  const { emit, gameState, isConnected } = socketResult
  const entries = gameState?.entries || []
  const maxCount = Math.max(1, ...entries.map((entry) => entry.count || 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 420, alignItems: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
        {cloudConfig.prompt || 'Word Cloud'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        {entries.length === 0 && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Waiting for submissions…</span>
        )}
        {entries.slice(0, cloudConfig.displayLimit || 50).map((entry) => {
          const size = 12 + Math.round(((entry.count || 1) / maxCount) * 18)
          return (
            <span
              key={entry.text}
              style={{
                color: element.accentColor || '#6366f1',
                fontSize: size,
                fontWeight: 800,
                lineHeight: 1,
                padding: '3px 6px',
              }}
            >
              {entry.text}
            </span>
          )
        })}
      </div>
      {isPresenting && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => emit?.('game-word-cloud-start', { gameId: element.id || 'word-cloud' })}
            style={{ background: element.accentColor || '#6366f1', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            {isConnected ? 'Start cloud' : 'Connecting…'}
          </button>
          <button
            onClick={() => emit?.('game-word-cloud-reveal', { gameId: element.id || 'word-cloud' })}
            style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Refresh
          </button>
          <button
            onClick={() => emit?.('game-word-cloud-clear', { gameId: element.id || 'word-cloud' })}
            style={{ background: 'rgba(239,68,68,0.2)', color: 'white', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Clear
          </button>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
        {gameState?.totalSubmissions || 0} submission{gameState?.totalSubmissions === 1 ? '' : 's'} · aggregate only
      </div>
    </div>
  )
}

function MatchingRenderer({ element, isPresenting }) {
  const matchingConfig = element.matching || element
  const pairs = React.useMemo(
    () => (Array.isArray(matchingConfig.pairs) ? matchingConfig.pairs : []),
    [matchingConfig.pairs]
  )
  const socketOptions = React.useMemo(() => ({
    gameType: 'matching',
    options: {
      prompt: matchingConfig.prompt || 'Matching',
      pairs,
    },
  }), [matchingConfig.prompt, pairs])
  const socketResult = useGameSocket(
    isPresenting ? element.id || 'matching' : null,
    isPresenting ? 'presenter' : null,
    'host',
    socketOptions
  )
  const { emit, gameState, isConnected } = socketResult
  const prompts = gameState?.prompts || pairs.map(pair => ({ id: pair.promptId, text: pair.prompt }))
  const targets = gameState?.targets || pairs.map(pair => ({ id: pair.targetId, text: pair.target }))
  const promptsById = React.useMemo(() => new Map(prompts.map(prompt => [prompt.id, prompt.text])), [prompts])
  const targetsById = React.useMemo(() => new Map(targets.map(target => [target.id, target.text])), [targets])
  const revealedPairs = (gameState?.answerKey || []).map(pair => ({
    prompt: promptsById.get(pair.promptId) || pair.promptId,
    target: targetsById.get(pair.targetId) || pair.targetId,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 420, alignItems: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
        {matchingConfig.prompt || 'Matching'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
        {[prompts, targets].map((items, columnIndex) => (
          <div key={columnIndex} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {items.slice(0, 8).map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.86)',
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                {item.text}
              </div>
            ))}
          </div>
        ))}
      </div>
      {isPresenting && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => emit?.('game-matching-start', { gameId: element.id || 'matching' })}
            style={{ background: element.accentColor || '#6366f1', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            {isConnected ? 'Start matching' : 'Connecting…'}
          </button>
          <button
            onClick={() => emit?.('game-matching-reveal', { gameId: element.id || 'matching' })}
            style={{ background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 'bold' }}
          >
            Reveal
          </button>
        </div>
      )}
      {revealedPairs.length > 0 && (
        <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8, padding: 8, fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>
          <strong style={{ display: 'block', color: 'white', marginBottom: 4 }}>Answers</strong>
          {revealedPairs.map((pair, index) => (
            <div key={`${pair.prompt}-${index}`}>{pair.prompt} → {pair.target}</div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
        {gameState?.submissions || 0} submission{gameState?.submissions === 1 ? '' : 's'} · pair IDs only
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 9: Interactive Jeopardy Board Components
// ---------------------------------------------------------------------------

const JEOPARDY_POINTS = [100, 200, 300, 400, 500]

// Build flat question lookup: { "catIdx-pointValue": questionObj }
function buildQuestionLookup(element) {
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
function getDailyDoubleKeys(element) {
  const dd = element.dailyDouble || []
  return new Set(Array.isArray(dd) ? dd : [])
}

// Interactive Jeopardy Board — full game UI (presentation mode only, uses hooks)
function InteractiveJeopardyBoard({ element }) {
  // Lazy-load useGameSocket only when needed (renderToString safe: hooks never execute)
  const [gameSocketFn, setGameSocketFn] = React.useState(
    () => (_id, _name, _role) => ({})
  )
  React.useEffect(() => {
    import('../../../hooks/use-game-socket.js').then(m => {
      setGameSocketFn(() => m.useGameSocket)
    })
  }, [])

  const gameId = element.id || 'jeopardy'
  const socketResult = gameSocketFn(gameId, 'presenter', 'presenter')
  const { lastEvent } = socketResult

  // Local game state
  const [scores, setScores] = React.useState(() => {
    const init = {}
    ;(element.teams || []).forEach(t => { init[t.id || t.name] = t.score || 0 })
    return init
  })
  const [usedCells, setUsedCells] = React.useState({})
  const [selectedCell, setSelectedCell] = React.useState(null) // { catIdx, pts, question }
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [activeTeam, setActiveTeam] = React.useState(null) // team id
  const [isDailyDouble, setIsDailyDouble] = React.useState(false)
  const [wager, setWager] = React.useState(0)
  const [showWagerModal, setShowWagerModal] = React.useState(false)
  const [_wagerTeamId, _setWagerTeamId] = React.useState(null)
  const [_timerSecs, _setTimerSecs] = React.useState(element.timerDuration || 30)
  const [timeLeft, setTimeLeft] = React.useState(null)
  const [timerInterval, setTimerInterval] = React.useState(null)
  const [gameEnded, setGameEnded] = React.useState(false)
  const [flipKey, setFlipKey] = React.useState(0)

  const qLookup = React.useMemo(() => buildQuestionLookup(element), [element])
  const ddKeys = React.useMemo(() => getDailyDoubleKeys(element), [element])

  // Sync socket events
  React.useEffect(() => {
    if (!lastEvent) return
    if (lastEvent.type === 'answer-result') {
      const { teamId, correct, points: pts } = lastEvent
      if (teamId && pts != null) {
        setScores(prev => ({
          ...prev,
          [teamId]: correct ? (prev[teamId] || 0) + pts : Math.max(0, (prev[teamId] || 0) - pts),
        }))
      }
      // Advance team after answer
      const teams = element.teams || []
      if (teams.length > 1) {
        const curIdx = activeTeam ? teams.findIndex(t => t.id === activeTeam) : -1
        const nextIdx = (curIdx + 1) % teams.length
        setActiveTeam(teams[nextIdx]?.id || null)
      }
    }
    if (lastEvent.type === 'question') {
      // { catIdx, pts, question }
      const { catIdx, pts, isDailyDouble: dd } = lastEvent
      if (catIdx != null && pts != null) {
        const key = `${catIdx}-${pts}`
        setSelectedCell({ catIdx, pts, question: qLookup[key] })
        setIsDailyDouble(dd || ddKeys.has(key))
        if (dd || ddKeys.has(key)) setShowWagerModal(true)
        setFlipKey(k => k + 1)
      }
    }
    if (lastEvent.type === 'leaderboard') {
      // { scores: { teamId: value } }
      if (lastEvent.scores) setScores(prev => ({ ...prev, ...lastEvent.scores }))
    }
    if (lastEvent.type === 'game-ended') setGameEnded(true)
  }, [lastEvent, activeTeam, ddKeys, qLookup, element.teams])

  // Timer
  React.useEffect(() => {
    if (timeLeft == null || timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev == null || prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    setTimerInterval(id)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft != null])

  const startTimer = React.useCallback((seconds) => {
    if (timerInterval) clearInterval(timerInterval)
    setTimeLeft(seconds)
  }, [timerInterval])

  const stopTimer = React.useCallback(() => {
    if (timerInterval) { clearInterval(timerInterval); setTimerInterval(null) }
    setTimeLeft(null)
  }, [timerInterval])

  const handleCellClick = React.useCallback((catIdx, pts) => {
    const key = `${catIdx}-${pts}`
    if (usedCells[key]) return
    const question = qLookup[key]
    const isDD = ddKeys.has(key)

    setSelectedCell({ catIdx, pts, question })
    setFlipKey(k => k + 1)
    setShowAnswer(false)
    stopTimer()

    if (isDD) {
      setIsDailyDouble(true)
      setShowWagerModal(true)
    } else {
      setIsDailyDouble(false)
      setShowWagerModal(false)
      if (element.showTimer !== false) startTimer(element.timerDuration || 30)
    }
  }, [usedCells, qLookup, ddKeys, element.timerDuration, element.showTimer, stopTimer, startTimer])

  const handleWagerSubmit = React.useCallback((teamId, wagerAmount) => {
    _setWagerTeamId(teamId)
    setWager(wagerAmount)
    setShowWagerModal(false)
    setActiveTeam(teamId)
  }, [])

  const handleCloseQuestion = React.useCallback(() => {
    if (selectedCell) {
      const key = `${selectedCell.catIdx}-${selectedCell.pts}`
      setUsedCells(prev => ({ ...prev, [key]: true }))
    }
    stopTimer()
    setSelectedCell(null)
    setShowAnswer(false)
    setIsDailyDouble(false)
    setWager(0)
    _setWagerTeamId(null)
    // Check game end
    const allUsed = Object.keys(qLookup).every(k => usedCells[k] || k === `${selectedCell?.catIdx}-${selectedCell?.pts}`)
    if (allUsed) setGameEnded(true)
  }, [selectedCell, qLookup, usedCells, stopTimer])

  const handleAnswer = React.useCallback((correct) => {
    stopTimer()
    setShowAnswer(false)
    if (!activeTeam) { handleCloseQuestion(); return }
    const pts = isDailyDouble ? wager : (selectedCell?.pts || 0)
    const earned = correct ? pts : (element.negativePoints ? -pts : 0)
    setScores(prev => ({
      ...prev,
      [activeTeam]: Math.max(0, (prev[activeTeam] || 0) + earned),
    }))
    // Auto-close after short delay
    setTimeout(() => handleCloseQuestion(), 800)
  }, [activeTeam, isDailyDouble, wager, selectedCell, element.negativePoints, stopTimer, handleCloseQuestion])

  const handleRevealAnswer = React.useCallback(() => {
    setShowAnswer(true)
    stopTimer()
  }, [stopTimer])

  const handleReturnToBoard = React.useCallback(() => {
    handleCloseQuestion()
  }, [handleCloseQuestion])

  // Daily Double Wager Modal
  if (showWagerModal) {
    const teams = element.teams || []
    return (
      <DailyDoubleWagerModal
        teams={teams}
        scores={scores}
        maxWager={element.maxWager || 1000}
        onSubmit={handleWagerSubmit}
        onCancel={() => { setShowWagerModal(false); setSelectedCell(null) }}
      />
    )
  }

  // Question Modal
  if (selectedCell) {
    return (
      <JeopardyQuestionModal
        key={`q-${flipKey}`}
        question={selectedCell.question}
        pts={isDailyDouble ? wager : selectedCell.pts}
        isDailyDouble={isDailyDouble}
        showAnswer={showAnswer}
        timeLeft={timeLeft}
        onReveal={handleRevealAnswer}
        onCorrect={() => handleAnswer(true)}
        onWrong={() => handleAnswer(false)}
        onClose={handleReturnToBoard}
        accentColor={element.accentColor || '#f59e0b'}
      />
    )
  }

  // Game ended screen
  if (gameEnded) {
    const teams = element.teams || []
    const sorted = [...teams].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, width: '100%', height: '100%' }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>🏆</div>
        <div style={{ fontSize: 18, fontWeight: 'bold', color: element.accentColor || '#f59e0b' }}>Game Over!</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {sorted.map((team, i) => (
            <div key={team.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: i === 0 ? `${team.color}30` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${i === 0 ? team.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, padding: '8px 16px',
            }}>
              <span style={{ fontSize: i === 0 ? 20 : 14 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: team.color }} />
              <span style={{ fontWeight: 'bold', color: 'white', fontSize: 14 }}>{team.name}</span>
              <span style={{ fontWeight: 'bold', color: team.color, fontSize: 16 }}>{scores[team.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Main board view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      <JeopardyBoard
        element={element}
        usedCells={usedCells}
        qLookup={qLookup}
        ddKeys={ddKeys}
        onCellClick={handleCellClick}
      />
      <TeamScorePanel
        teams={element.teams || []}
        scores={scores}
        activeTeam={activeTeam}
        onSelectTeam={setActiveTeam}
      />
      <PresenterControls
        teams={element.teams || []}
        activeTeam={activeTeam}
        onSelectTeam={setActiveTeam}
        onReveal={null}
        onReturn={null}
        accentColor={element.accentColor || '#f59e0b'}
        showFinalJeopardy={() => setGameEnded(true)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// JeopardyBoard — 5x5 grid (shared by edit + present modes)
// ---------------------------------------------------------------------------
function JeopardyBoard({ element, usedCells, qLookup, ddKeys, onCellClick }) {
  const cats = element.categories || []
  const accent = element.accentColor || '#f59e0b'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Category header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 3,
        marginBottom: 3,
        flexShrink: 0,
      }}>
        {JEOPARDY_POINTS.map((pts, i) => {
          const cat = cats[i]
          const catName = cat ? (cat.name || String(cat)) : `Category ${i + 1}`
          return (
            <div key={pts} style={{
              background: accent,
              borderRadius: 4,
              padding: '4px 2px',
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 'bold',
              color: '#1a1a2e',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minHeight: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {catName}
            </div>
          )
        })}
      </div>

      {/* Point value rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {JEOPARDY_POINTS.map(pts => (
          <div key={pts} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 3,
            flex: 1,
          }}>
            {JEOPARDY_POINTS.map((_, catIdx) => {
              const key = `${catIdx}-${pts}`
              const used = !!usedCells?.[key]
              const isDD = ddKeys?.has(key)
              const _hasQuestion = !!qLookup?.[key]
              const interactive = !!onCellClick

              return (
                <div
                  key={key}
                  onClick={() => interactive && !used ? onCellClick(catIdx, pts) : undefined}
                  style={{
                    position: 'relative',
                    background: used
                      ? 'rgba(0,0,0,0.4)'
                      : isDD
                        ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                        : `${accent}22`,
                    border: isDD
                      ? '2px solid #fbbf24'
                      : `1px solid ${accent}55`,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 'bold',
                    color: used ? 'rgba(255,255,255,0.3)' : isDD ? '#1a1a2e' : accent,
                    cursor: interactive && !used ? 'pointer' : 'default',
                    minHeight: 28,
                    flex: 1,
                    transition: 'background 0.2s',
                    userSelect: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {used ? (
                    <span style={{ fontSize: 10 }}>✓</span>
                  ) : (
                    <span>{pts}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JeopardyQuestionModal — card flip with question/answer
// ---------------------------------------------------------------------------
function JeopardyQuestionModal({ question, pts, isDailyDouble, showAnswer, timeLeft, onReveal, onCorrect, onWrong, onClose, accentColor }) {
  const flipStyle = {
    perspective: '800px',
    width: '100%',
    maxWidth: 480,
    height: 260,
    cursor: 'pointer',
    position: 'relative',
  }
  const cardStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.6s',
    transform: showAnswer ? 'rotateY(180deg)' : 'rotateY(0deg)',
  }
  const faceStyle = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    boxSizing: 'border-box',
    gap: 12,
  }
  const frontStyle = {
    ...faceStyle,
    background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`,
    border: `2px solid ${accentColor}`,
  }
  const backStyle = {
    ...faceStyle,
    background: `linear-gradient(135deg, #1a2e1a 0%, #162116 100%)`,
    border: '2px solid #22c55e',
    transform: 'rotateY(180deg)',
  }
  const questionText = question?.question || 'No question configured'
  const answerText = question?.answer || question?.correctIndex != null
    ? String(question.options?.[question.correctIndex] || 'Answer')
    : (question?.answer || 'No answer')

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      zIndex: 9999,
      padding: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 500 }}>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          ✕
        </button>
        <div style={{
          flex: 1,
          background: isDailyDouble ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : accentColor,
          borderRadius: 6,
          padding: '4px 12px',
          textAlign: 'center',
          fontWeight: 'bold',
          color: isDailyDouble ? '#1a1a2e' : '#fff',
          fontSize: 13,
        }}>
          {isDailyDouble ? 'DAILY DOUBLE!' : `${pts} Points`}
        </div>
        {timeLeft != null && (
          <div style={{
            background: timeLeft <= 5 ? '#ef4444' : 'rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '4px 12px',
            color: timeLeft <= 5 ? 'white' : 'rgba(255,255,255,0.7)',
            fontSize: 12,
            fontWeight: 'bold',
            minWidth: 48,
            textAlign: 'center',
          }}>
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Flip card */}
      <div style={flipStyle} onClick={!showAnswer ? onReveal : undefined}>
        <div style={cardStyle}>
          {/* Front: question */}
          <div style={frontStyle}>
            {!showAnswer && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                Click to reveal answer
              </div>
            )}
            <div data-testid="game-question" style={{ fontSize: 14, color: 'white', textAlign: 'center', lineHeight: 1.5, fontFamily: 'sans-serif', maxHeight: 160, overflow: 'auto', width: '100%' }}>
              {questionText}
            </div>
            {question?.options && question.options.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                {question.options.map((opt, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Back: answer */}
          <div style={backStyle}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
              Answer
            </div>
            <div style={{ fontSize: 16, color: '#22c55e', textAlign: 'center', fontWeight: 'bold', fontFamily: 'sans-serif', lineHeight: 1.4 }}>
              {answerText}
            </div>
          </div>
        </div>
      </div>

      {/* Answer buttons */}
      {showAnswer && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCorrect}
            style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
          >
            ✓ Correct
          </button>
          <button
            onClick={onWrong}
            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
          >
            ✗ Wrong
          </button>
        </div>
      )}

      {/* Reveal button */}
      {!showAnswer && (
        <button
          onClick={onReveal}
          style={{ background: accentColor, color: 'white', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
        >
          Reveal Answer
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DailyDoubleWagerModal
// ---------------------------------------------------------------------------
function DailyDoubleWagerModal({ teams, scores, maxWager, onSubmit, onCancel }) {
  const [wagerAmount, setWagerAmount] = React.useState(() => {
    const first = teams[0]
    return first ? Math.min(scores[first.id] || 0, maxWager) : maxWager
  })
  const [selectedTeamId, setSelectedTeamId] = React.useState(teams[0]?.id || null)

  const getMaxWager = (teamId) => {
    const teamScore = scores[teamId] || 0
    return Math.max(teamScore, maxWager)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, zIndex: 9999, padding: 16,
    }}>
      <div style={{ fontSize: 36, lineHeight: 1 }}>🎯</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fbbf24', fontFamily: 'sans-serif' }}>
        Daily Double!
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif' }}>
        Select team and enter wager
      </div>

      {/* Team selection */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {teams.map(team => (
          <button
            key={team.id || team.name}
            onClick={() => {
              setSelectedTeamId(team.id || team.name)
              setWagerAmount(Math.min(scores[team.id] || 0, maxWager))
            }}
            style={{
              background: selectedTeamId === (team.id || team.name) ? team.color : 'rgba(255,255,255,0.1)',
              border: `2px solid ${team.color}`,
              borderRadius: 8,
              padding: '8px 16px',
              color: 'white',
              fontSize: 13,
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span>{team.name}</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{scores[team.id] || 0} pts</span>
          </button>
        ))}
      </div>

      {/* Wager input */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'sans-serif' }}>
          Wager (max: {getMaxWager(selectedTeamId)})
        </label>
        <input
          type="number"
          min={0}
          max={getMaxWager(selectedTeamId)}
          value={wagerAmount}
          onChange={e => setWagerAmount(Math.max(0, Math.min(getMaxWager(selectedTeamId), parseInt(e.target.value, 10) || 0)))}
          style={{
            width: 160,
            background: 'rgba(255,255,255,0.1)',
            border: '2px solid #fbbf24',
            borderRadius: 8,
            padding: '8px 16px',
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            fontFamily: 'sans-serif',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onCancel}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 24px', color: 'white', fontSize: 13, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={() => selectedTeamId && onSubmit(selectedTeamId, wagerAmount)}
          style={{ background: '#fbbf24', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#1a1a2e', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}
        >
          Place Wager
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TeamScorePanel
// ---------------------------------------------------------------------------
function TeamScorePanel({ teams, scores, activeTeam, onSelectTeam }) {
  if (!teams || teams.length === 0) return null
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexShrink: 0,
      paddingTop: 8,
      justifyContent: 'center',
      flexWrap: 'wrap',
    }}>
      {teams.map((team, i) => {
        const isActive = activeTeam === (team.id || team.name)
        const score = scores[team.id || team.name] || 0
        return (
          <div
            key={team.id || i}
            onClick={() => onSelectTeam && onSelectTeam(team.id || team.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isActive ? `${team.color}30` : 'rgba(255,255,255,0.05)',
              border: `2px solid ${isActive ? team.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              padding: '4px 12px',
              cursor: onSelectTeam ? 'pointer' : 'default',
              transition: 'border-color 0.2s, background 0.2s',
              minWidth: 100,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: team.color, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.2 }}>{team.name}</span>
              <span data-testid="game-score" style={{ fontSize: 13, fontWeight: 'bold', color: team.color, lineHeight: 1.2 }}>{score}</span>
            </div>
            {isActive && <span style={{ fontSize: 9, color: team.color }}>▶</span>}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PresenterControls
// ---------------------------------------------------------------------------
function PresenterControls({ teams, activeTeam, onSelectTeam, _onReveal, _onReturn, _accentColor, showFinalJeopardy }) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexShrink: 0,
      paddingTop: 8,
      justifyContent: 'center',
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      {/* Team selection */}
      {teams.map((team, i) => (
        <button
          key={team.id || i}
          onClick={() => onSelectTeam && onSelectTeam(team.id || team.name)}
          style={{
            background: activeTeam === (team.id || team.name) ? team.color : 'rgba(255,255,255,0.1)',
            border: `2px solid ${team.color}`,
            borderRadius: 6,
            padding: '3px 10px',
            color: 'white',
            fontSize: 10,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {team.name}
        </button>
      ))}

      {showFinalJeopardy && (
        <button
          onClick={showFinalJeopardy}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            padding: '3px 10px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Final Jeopardy
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Jeopardy renderer — static board (edit mode) + interactive (present mode)
// ---------------------------------------------------------------------------
function JeopardyRenderer({ element, isPresenting }) {
  const categories = element.categories || []

  // Edit mode: full 5x5 static board preview
  if (!isPresenting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 2 }}>🏆</div>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: element.accentColor || '#f59e0b', marginBottom: 4 }}>{element.title || 'Jeopardy'}</div>
        <JeopardyBoard
          element={element}
          usedCells={{}}
          qLookup={buildQuestionLookup(element)}
          ddKeys={getDailyDoubleKeys(element)}
          onCellClick={null}
        />
        {categories.length === 0 && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: 4 }}>
            Configure categories and questions in properties panel
          </div>
        )}
      </div>
    )
  }

  // Presentation mode: full interactive board
  return <InteractiveJeopardyBoard element={element} />
}

// ---------------------------------------------------------------------------
// Four Corners renderer — static (edit) + interactive (present)
// ---------------------------------------------------------------------------
function FourCornersRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getFourCornersInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  const corners = ['NW', 'NE', 'SW', 'SE']
  const count = element.cornerCount || 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🧭</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: 120, height: 80 }}>
        {corners.slice(0, count).map((corner, _i) => (
          <div key={corner} style={{
            border: `2px solid ${element.accentColor || '#10b981'}`,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 'bold',
            color: element.accentColor || '#10b981',
            background: `${element.accentColor || '#10b981'}18`,
          }}>
            {corner}
          </div>
        ))}
      </div>
      {element.showTimer && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          Timer: {element.eliminateMode || 'wrong'} elimination
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Relay Race renderer — static (edit) + interactive (present)
// ---------------------------------------------------------------------------
function RelayRaceRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getRelayRaceInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🏃</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: element.accentColor || '#f97316' }}>Relay Race</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
        {element.questionsPerRound || 4} Q/round
        {element.passOnWrong ? ' · Pass on wrong' : ''}
        {element.shuffleTeams ? ' · Shuffle' : ''}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trivia Champ renderer — static (edit) + interactive (present)
// ---------------------------------------------------------------------------
function TriviaChampRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getTriviaChampInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  const rounds = element.rounds || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>💡</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: element.accentColor || '#8b5cf6' }}>Trivia Championship</div>
      {rounds.length > 0 ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
          {rounds.map(r => r.name || 'Round').join(' · ')}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          Lightning: {element.lightningRound ? 'enabled' : 'off'} · Jackpot: {element.jackpotRound ? 'enabled' : 'off'}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scattergories renderer — static (edit) + interactive (present)
// ---------------------------------------------------------------------------
function ScattergoriesRenderer({ element, isPresenting }) {
  const [Interactive, setInteractive] = React.useState(null)
  React.useEffect(() => {
    if (isPresenting) {
      getScattergoriesInteractiveP().then(setInteractive)
    }
  }, [isPresenting])

  if (isPresenting) {
    if (!Interactive) return <LoadingFallback />
    return <Interactive element={{ ...element, isPresenting: true }} />
  }
  const categories = element.categories || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>📝</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: element.accentColor || '#ec4899' }}>Scattergories</div>
      {categories.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 240, padding: '0 8px' }}>
          {categories.slice(0, 6).map((cat, i) => (
            <div key={i} style={{
              background: 'rgba(236,72,153,0.15)',
              border: `1px solid ${element.accentColor || '#ec4899'}`,
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: 9,
              color: element.accentColor || '#ec4899',
              maxWidth: 90,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {cat.name || cat}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
          {element.timePerRound || 60}s/round · {element.letterMode || 'random'} letters
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fallback renderer (unknown game type)
// ---------------------------------------------------------------------------
function FallbackRenderer({ element }) {
  const label = element.gameType || 'Game'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, width: '100%', height: '100%',
    }}>
      <div style={{ fontSize: 40, lineHeight: 1 }}>❓</div>
      <div style={{ fontSize: 13, fontWeight: 'bold', color: element.accentColor || '#888' }}>
        Game: {label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game controls (SPIN / START button — presentation mode only)
// ---------------------------------------------------------------------------
function GameControls({ element }) {
  const isRunning = element.gameStatus === 'running'

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <button
        disabled={isRunning}
        style={{
          background: element.accentColor || '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '6px 24px',
          fontSize: 13,
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          cursor: isRunning ? 'default' : 'pointer',
          opacity: isRunning ? 0.5 : 1,
          pointerEvents: isRunning ? 'none' : 'auto',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {isRunning ? 'Running…' : element.gameType === 'hot-potato' ? 'START' : 'SPIN'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------
// Lazy wrapper for name-picker interactive mode
function NamePickerInteractiveWrapper({ element, isPresenting }) {
  const [I, setI] = React.useState(null)
  React.useEffect(() => {
    getNamePickerInteractiveP().then(setI)
  }, [])
  if (!I) return <LoadingFallback />
  return <I element={element} isPresenting={isPresenting} />
}

export function GameElementRenderer(props) {
  // Support flat props or nested element={...} pattern
  const el = props.element ?? props
  const isPresenting = props.isPresenting === true
  const isRunning = el.gameStatus === 'running'
  const isEnded = el.gameStatus === 'ended'

  const bgColor = el.backgroundColor || '#1a1a2e'
  const accent = el.accentColor || '#6366f1'

  const renderGameContent = () => {
    switch (el.gameType) {
      case 'name-picker':
        if (isPresenting) {
          return <NamePickerInteractiveWrapper element={el} isPresenting={isPresenting} />
        }
        return <NamePickerRenderer element={el} isPresenting={isPresenting} />
      case 'hot-potato':
        return <HotPotatoRenderer element={el} isPresenting={isPresenting} />
      case 'jeopardy':
        return <JeopardyRenderer element={el} isPresenting={isPresenting} />
      case 'four-corners':
        return <FourCornersRenderer element={el} isPresenting={isPresenting} />
      case 'relay-race':
        return <RelayRaceRenderer element={el} isPresenting={isPresenting} />
      case 'trivia-champ':
        return <TriviaChampRenderer element={el} isPresenting={isPresenting} />
      case 'scattergories':
        return <ScattergoriesRenderer element={el} isPresenting={isPresenting} />
      case 'poll':
        return <PollRenderer element={el} isPresenting={isPresenting} />
      case 'word-cloud':
        return <WordCloudRenderer element={el} isPresenting={isPresenting} />
      case 'matching':
        return <MatchingRenderer element={el} isPresenting={isPresenting} />
      default:
        return <FallbackRenderer element={el} />
    }
  }

  const gameLabel = GAME_TYPE_LABELS[el.gameType] || el.gameType || 'Game'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: bgColor,
        borderRadius: 8,
        color: '#ffffff',
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Top label */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: accent,
        pointerEvents: 'none',
      }}>
        Game: {gameLabel}
      </div>

      {/* Game content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: '28px 16px 32px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {renderGameContent()}
      </div>

      {/* Setup placeholder — only shown in edit mode when status is setup */}
      {!isPresenting && el.gameStatus === 'setup' && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 10,
          color: 'rgba(255,255,255,0.4)',
          fontStyle: 'italic',
          pointerEvents: 'none',
        }}>
          Configure in properties panel
        </div>
      )}

      {/* Controls — only in presentation mode (name-picker has its own controls) */}
      {isPresenting && (isRunning || !isEnded) && !['name-picker', 'poll', 'word-cloud'].includes(el.gameType) && (
        <GameControls element={el} />
      )}
    </div>
  )
}
