/**
 * Name Picker Interactive Game Renderer — Phase 7.
 *
 * Full interactive Name Picker with wheel spin, dice roll, button pick,
 * confetti effects, and Socket.IO integration.
 *
 * Exported as NamePickerRenderer to match the lazy-loading interface used
 * by game-element-renderer.jsx.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useGameSocket } from '../../../../hooks/use-game-socket'

// ---------------------------------------------------------------------------
// CSS keyframes (injected once)
// ---------------------------------------------------------------------------
const CSS_KEYFRAMES = `
@keyframes winner-pop {
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes spin-btn-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
  50%       { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px 2px currentColor; transform: scale(1); }
  50%       { box-shadow: 0 0 24px 8px currentColor; transform: scale(1.04); }
}
@keyframes dice-land {
  0%   { transform: rotateX(var(--dx, 0deg)) rotateY(var(--dy, 0deg)) rotateZ(0deg); }
  100% { transform: rotateX(calc(var(--dx, 0deg) + 360deg)) rotateY(calc(var(--dy, 0deg) + 180deg)) rotateZ(0deg); }
}
`
let cssInjected = false
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return
  cssInjected = true
  const s = document.createElement('style')
  s.textContent = CSS_KEYFRAMES
  document.head.appendChild(s)
}

// ---------------------------------------------------------------------------
// Dice pip patterns for faces 1-6
// ---------------------------------------------------------------------------
const DICE_PIPS = {
  1: [[14, 14]],
  2: [[7, 7], [21, 21]],
  3: [[7, 7], [14, 14], [21, 21]],
  4: [[7, 7], [21, 7], [7, 21], [21, 21]],
  5: [[7, 7], [21, 7], [14, 14], [7, 21], [21, 21]],
  6: [[7, 7], [7, 14], [7, 21], [21, 7], [21, 14], [21, 21]],
}

function DiceFaceSVG({ value, size = 40, color = '#6366f1' }) {
  const pips = DICE_PIPS[value] || DICE_PIPS[6]
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <rect x="1" y="1" width="26" height="26" rx="4" fill={color} />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="white" />
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Static wheel SVG
// ---------------------------------------------------------------------------
function StaticWheelSVG({ element, spinAngle = 0 }) {
  const colors = element.wheelColors?.length > 0
    ? element.wheelColors
    : ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#FF9800', '#795548']
  const segments = element.wheelSegments || 8
  const items = element.items || []
  const svgR = 70
  const cx = 90
  const cy = 90
  const radPerSeg = (2 * Math.PI) / segments
  const pointerH = 18
  const accent = element.accentColor || '#6366f1'
  const bgColor = element.backgroundColor || '#1a1a2e'
  const angleRad = spinAngle * Math.PI / 180

  return (
    <svg width="180" height="196" viewBox="0 0 180 196" style={{ overflow: 'visible' }}>
      <circle cx={cx} cy={cy} r={svgR} fill="none" stroke={accent} strokeWidth="2" />
      {Array.from({ length: segments }).map((_, i) => {
        const startAngle = i * radPerSeg - Math.PI / 2 + angleRad
        const endAngle = startAngle + radPerSeg
        const x1 = cx + svgR * Math.cos(startAngle)
        const y1 = cy + svgR * Math.sin(startAngle)
        const x2 = cx + svgR * Math.cos(endAngle)
        const y2 = cy + svgR * Math.sin(endAngle)
        return (
          <path key={i} d={`M${cx},${cy} L${x1},${y1} A${svgR},${svgR} 0 0,1 ${x2},${y2} Z`}
            fill={colors[i % colors.length]} opacity="0.85" />
        )
      })}
      <circle cx={cx} cy={cy} r="14" fill={bgColor} />
      <circle cx={cx} cy={cy} r="14" fill="none" stroke={accent} strokeWidth="2" />
      <polygon points={`${cx},${cy - svgR - 2} ${cx - 7},${cy - svgR + pointerH} ${cx + 7},${cy - svgR + pointerH}`} fill={accent} />
      {items.slice(0, Math.min(items.length, 3)).map((item, i) => {
        const angle = (i * 2 * Math.PI) / Math.max(items.length || 1, 1) - Math.PI / 2 + angleRad
        const tx = cx + (svgR * 0.55) * Math.cos(angle)
        const ty = cy + (svgR * 0.55) * Math.sin(angle)
        return (
          <text key={i} x={tx} y={ty} fill="white" fontSize="8" textAnchor="middle" dominantBaseline="middle"
            style={{ fontFamily: 'sans-serif', fontWeight: 'bold', pointerEvents: 'none' }}>
            {String(item).slice(0, 6)}
          </text>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Confetti helper
// ---------------------------------------------------------------------------
function fireConfetti(element) {
  if (typeof window === 'undefined') return
  if (element.showConfetti === false) return
  import('canvas-confetti').then(({ default: confetti }) => {
    const colors = element.wheelColors?.length > 0
      ? element.wheelColors
      : ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#FF9800', '#795548']
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors })
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.7 }, colors }), 200)
  })
}

// ---------------------------------------------------------------------------
// Interactive wheel picker
// ---------------------------------------------------------------------------
function InteractiveWheel({ element, onWinner, disabled }) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [spinAngle, setSpinAngle] = useState(0)
  const [winnerName, setWinnerName] = useState(null)
  const [winnerIdx, setWinnerIdx] = useState(-1)
  const [_isLanding, setIsLanding] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- items is stable derived from prop; onWinner is the true volatility source
  const items = element.items || []
  const segments = element.wheelSegments || 8
  const duration = element.animationDuration || 2500
  const accent = element.accentColor || '#6366f1'

  const handleSpin = useCallback(() => {
    if (isSpinning || disabled || items.length === 0) return
    setIsSpinning(true)
    setWinnerName(null)
    setWinnerIdx(-1)

    const winnerIndex = Math.floor(Math.random() * items.length)
    const anglePerSegment = 360 / segments
    const baseSpins = 2880
    const landAngle = winnerIndex * anglePerSegment + anglePerSegment / 2
    const totalAngle = baseSpins + (360 - landAngle)
    const startAngle = spinAngle % 360
    const finalAngle = startAngle + totalAngle

    const wheelEl = document.getElementById('game-wheel-interactive')
    if (wheelEl) {
      wheelEl.style.transition = `transform ${duration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
      wheelEl.style.transform = `rotate(${finalAngle}deg)`
    }

    setTimeout(() => {
      setIsSpinning(false)
      setIsLanding(true)
      setSpinAngle(finalAngle % 360)
      const name = items[winnerIndex]
      setWinnerName(name)
      setWinnerIdx(winnerIndex)
      onWinner && onWinner(name, winnerIndex)
      setTimeout(() => setIsLanding(false), 1500)
    }, duration)
  }, [isSpinning, disabled, items, segments, duration, spinAngle, onWinner])

  const winnerColor = winnerIdx >= 0
    ? ((element.wheelColors || [])[winnerIdx % (element.wheelColors?.length || 8)] || accent)
    : accent

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', height: '100%' }}>
      <div style={{ overflow: 'hidden', height: 196 }}>
        <div id="game-wheel-interactive" style={{ transform: `rotate(${spinAngle}deg)`, display: 'inline-block' }}>
          <StaticWheelSVG element={element} />
        </div>
      </div>
      {items.length > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', maxWidth: 160, textAlign: 'center' }}>
          {items.length} items — {items.slice(0, 2).join(', ')}{items.length > 2 ? '…' : ''}
        </div>
      )}
      {winnerName && (
        <div style={{ animation: 'winner-pop 0.5s ease-out forwards', fontSize: 14, fontWeight: 'bold', color: winnerColor, textAlign: 'center' }}>
          {winnerName}
        </div>
      )}
      <button
        onClick={handleSpin}
        disabled={isSpinning || disabled}
        style={{
          background: accent, color: 'white', border: 'none', borderRadius: 8,
          padding: '5px 18px', fontSize: 12, fontWeight: 'bold',
          cursor: isSpinning || disabled ? 'default' : 'pointer',
          opacity: isSpinning || disabled ? 0.5 : 1,
          pointerEvents: isSpinning || disabled ? 'none' : 'auto',
          textTransform: 'uppercase',
          animation: !isSpinning && !disabled ? 'spin-btn-pulse 2s infinite' : 'none',
        }}
      >
        {isSpinning ? 'Spinning…' : 'SPIN'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Interactive dice picker
// ---------------------------------------------------------------------------
function InteractiveDice({ element, onWinner, disabled }) {
  const [isRolling, setIsRolling] = useState(false)
  const [diceValues, setDiceValues] = useState([6, 6])
  const [winnerName, setWinnerName] = useState(null)
  const [_winnerIdx, setWinnerIdx] = useState(-1)
  const [_isLanding, setIsLanding] = useState(false)
  const diceCount = element.diceCount || 2
  // eslint-disable-next-line react-hooks/exhaustive-deps -- items is stable derived from prop; onWinner is the true volatility source
  const items = element.items || []
  const duration = element.animationDuration || 2500
  const accent = element.accentColor || '#6366f1'
  const cycleRef = useRef(null)

  const handleRoll = useCallback(() => {
    if (isRolling || disabled || items.length === 0) return
    setIsRolling(true)
    setWinnerName(null)
    setWinnerIdx(-1)

    let cycles = 0
    const maxCycles = 18
    const cycleInterval = Math.floor(duration / maxCycles)
    const winnerIndex = Math.floor(Math.random() * items.length)

    const cycle = () => {
      if (cycles < maxCycles) {
        setDiceValues([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])
        cycles++
        cycleRef.current = setTimeout(cycle, cycleInterval)
      } else {
        setDiceValues([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])
        setIsRolling(false)
        setIsLanding(true)
        const name = items[winnerIndex]
        setWinnerName(name)
        setWinnerIdx(winnerIndex)
        onWinner && onWinner(name, winnerIndex)
        setTimeout(() => setIsLanding(false), 1500)
      }
    }
    cycle()
  }, [isRolling, disabled, items, duration, onWinner])

  useEffect(() => () => { if (cycleRef.current) clearTimeout(cycleRef.current) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', perspective: 200 }}>
        {Array.from({ length: diceCount }).map((_, i) => (
          <div key={i} style={{
            width: 48, height: 48, position: 'relative',
            animation: isRolling
              ? `dice-land ${0.1 + i * 0.03}s linear infinite`
              : _isLanding ? `dice-land 0.4s ease-out forwards` : 'none',
            '--dx': `${Math.random() * 360}deg`,
            '--dy': `${Math.random() * 360}deg`,
          }}>
            <DiceFaceSVG value={diceValues[i] || 6} size={48} color={accent} />
          </div>
        ))}
      </div>
      {winnerName && (
        <div style={{ animation: 'winner-pop 0.5s ease-out forwards', fontSize: 14, fontWeight: 'bold', color: accent }}>
          {winnerName}
        </div>
      )}
      <button
        onClick={handleRoll}
        disabled={isRolling || disabled}
        style={{
          background: accent, color: 'white', border: 'none', borderRadius: 8,
          padding: '5px 18px', fontSize: 12, fontWeight: 'bold',
          cursor: isRolling || disabled ? 'default' : 'pointer',
          opacity: isRolling || disabled ? 0.5 : 1,
          pointerEvents: isRolling || disabled ? 'none' : 'auto',
          textTransform: 'uppercase',
          animation: !isRolling && !disabled ? 'spin-btn-pulse 2s infinite' : 'none',
        }}
      >
        {isRolling ? 'Rolling…' : 'ROLL'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Interactive button picker
// ---------------------------------------------------------------------------
function InteractiveButtonPicker({ element, onWinner, disabled }) {
  const [winnerName, setWinnerName] = useState(null)
  const [_winnerIdx, setWinnerIdx] = useState(-1)
  const [isPicking, setIsPicking] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- items is stable derived from prop; onWinner is the true volatility source
  const items = element.items || []
  const accent = element.accentColor || '#6366f1'
  const cycleRef = useRef(null)

  const handlePick = useCallback(() => {
    if (disabled || items.length === 0) return
    setIsPicking(true)
    setWinnerName(null)
    setWinnerIdx(-1)

    let cycles = 0
    const maxCycles = 14
    const interval = 70
    const winnerIndex = Math.floor(Math.random() * items.length)

    const cycle = () => {
      if (cycles < maxCycles) {
        setWinnerIdx(Math.floor(Math.random() * items.length))
        cycles++
        cycleRef.current = setTimeout(cycle, interval)
      } else {
        clearTimeout(cycleRef.current)
        setWinnerIdx(winnerIndex)
        const name = items[winnerIndex]
        setWinnerName(name)
        setIsPicking(false)
        onWinner && onWinner(name, winnerIndex)
      }
    }
    cycle()
  }, [disabled, items, onWinner])

  useEffect(() => () => { if (cycleRef.current) clearTimeout(cycleRef.current) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <button
        onClick={handlePick}
        disabled={isPicking || disabled}
        style={{
          width: 100, height: 100, borderRadius: '50%',
          background: accent, border: 'none',
          cursor: isPicking || disabled ? 'default' : 'pointer',
          opacity: isPicking || disabled ? 0.7 : 1,
          pointerEvents: isPicking || disabled ? 'none' : 'auto',
          color: 'white', fontSize: 14, fontWeight: 'bold',
          textTransform: 'uppercase',
          animation: !isPicking && !disabled ? `pulse-glow 2s ease-in-out infinite` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 20px ${accent}66`,
          transition: 'transform 0.1s',
        }}
        onMouseDown={e => { if (!isPicking && !disabled) e.currentTarget.style.transform = 'scale(0.95)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {isPicking ? '…' : 'PICK!'}
      </button>
      {winnerName && (
        <div style={{ animation: 'winner-pop 0.5s ease-out forwards', fontSize: 15, fontWeight: 'bold', color: accent, textAlign: 'center' }}>
          {winnerName}
        </div>
      )}
      {items.length > 0 && !winnerName && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{items.length} choices</div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main renderer (exported as NamePickerRenderer)
// ---------------------------------------------------------------------------
export function NamePickerRenderer({ element, isPresenting }) {
  const mode = element.pickerMode || 'wheel'
  const [lastWinner, setLastWinner] = useState(null)
  const [excludedSet, setExcludedSet] = useState(new Set())

  useEffect(() => { injectCSS() }, [])

  const gameOptions = useMemo(() => ({
    gameType: 'name-picker',
    options: {
      items: element.items || [],
      excludeAfterPick: element.excludeAfterPick !== false,
    },
  }), [element.excludeAfterPick, element.items])
  const { emit, isConnected, joinError, lastEvent } = useGameSocket(
    isPresenting ? element.id : null,
    isPresenting ? 'presenter' : null,
    'host',
    gameOptions
  )

  const effectiveItems = (element.items || []).filter((_, i) => !excludedSet.has(i))

  const handleWinner = useCallback((name, idx) => {
    // When live, the server is authoritative: request a pick and let the
    // game-random-result event (below) decide the announced winner so every
    // client renders the SAME index. Offline (no game room) we fall back to
    // the local animation result so the picker still works in the editor.
    if (isPresenting && !isConnected) return
    if (emit && isConnected) {
      emit('game-random', { gameId: element.id, gameType: 'name-picker', mode })
      return
    }
    setLastWinner({ name, idx })
    fireConfetti(element)
  }, [element, emit, isConnected, isPresenting, mode])

  // Render the SERVER-chosen winner so it matches every other client.
  useEffect(() => {
    if (lastEvent?.type !== 'random-result') return
    const idx = lastEvent.winnerIndex
    if (typeof idx !== 'number' || idx < 0) return
    const hasStableWinner = Object.prototype.hasOwnProperty.call(lastEvent, 'winner')
    const name = hasStableWinner
      ? lastEvent.winner
      : (element.items || [])[idx]
    const authoredIndex = hasStableWinner
      ? (element.items || []).indexOf(name)
      : idx
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing UI to an external socket event is the intended use
    setLastWinner({ name, idx: authoredIndex })
    fireConfetti(element)
  }, [lastEvent, element])

  const handleExclude = useCallback(() => {
    if (lastWinner?.idx !== undefined) {
      setExcludedSet(prev => new Set([...prev, lastWinner.idx]))
    }
  }, [lastWinner])

  let content
  if (mode === 'wheel') {
    content = <InteractiveWheel element={element} onWinner={handleWinner} disabled={!isPresenting || !isConnected || effectiveItems.length === 0} />
  } else if (mode === 'dice') {
    content = <InteractiveDice element={element} onWinner={handleWinner} disabled={!isPresenting || !isConnected || effectiveItems.length === 0} />
  } else {
    content = <InteractiveButtonPicker element={element} onWinner={handleWinner} disabled={!isPresenting || !isConnected || effectiveItems.length === 0} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      {content}
      {joinError && (
        <div role="alert" style={{ color: '#fecaca', fontSize: 10, textAlign: 'center' }}>
          Game connection failed: {joinError}
        </div>
      )}
      {isPresenting && lastWinner && element.excludeAfterPick && effectiveItems.length > 1 && (
        <button onClick={handleExclude} style={{
          background: 'transparent', border: `1px solid ${element.accentColor || '#6366f1'}66`,
          borderRadius: 6, padding: '3px 10px', fontSize: 10,
          color: `${element.accentColor || '#6366f1'}99`, cursor: 'pointer',
        }}>
          Remove & Pick Again
        </button>
      )}
    </div>
  )
}
