import { useRef, useEffect } from 'react'
import { getFxModule } from 'revealjs-shared'

/**
 * Editor-side FX background canvas. Uses the SAME shared FX module as the
 * htmlGenerator export runtime (single source of truth), so the editor preview
 * matches present/export. Pauses when `active` is false (slide not focused) and
 * honors prefers-reduced-motion (static first frame).
 */
export default function SlideBackgroundFxCanvas({ fx, width, height, active = true }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const fxName = fx?.name
  const fxParamsKey = JSON.stringify(fx?.params || {})

  useEffect(() => {
    const canvas = canvasRef.current
    const mod = fxName && getFxModule(fxName)
    if (!canvas || !mod) return

    let userParams = {}
    try { userParams = JSON.parse(fxParamsKey) } catch { /* default params only */ }
    const params = { ...mod.defaultParams, ...userParams }
    const w = width || 960
    const h = height || 540
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    let state = mod.initState(w, h, params)

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduce || !active) {
      // Static first frame only — no animation loop.
      try { mod.draw(ctx, state, 0, params, w, h) } catch { /* ignore draw errors */ }
      return
    }

    const frame = (ms) => {
      try { mod.draw(ctx, state, ms / 1000, params, w, h) } catch { /* ignore draw errors */ }
      rafRef.current = window.requestAnimationFrame(frame)
    }
    rafRef.current = window.requestAnimationFrame(frame)

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [fxName, fxParamsKey, width, height, active])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  )
}
