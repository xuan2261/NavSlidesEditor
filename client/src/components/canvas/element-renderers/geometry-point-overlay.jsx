import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import affine from 'revealjs-shared/src/pptx-affine.js'

export default function GeometryPointOverlay({ sourceSvg, children, geometry, element }) {
  const root = useRef(null)
  useLayoutEffect(() => {
    if (!sourceSvg) return
    const position = () => {
      const overlay = root.current.ownerSVGElement
      const inert = Boolean(sourceSvg.closest('[inert]'))
      overlay.toggleAttribute('inert', inert)
      overlay.style.visibility = inert ? 'hidden' : ''
      const screen = sourceSvg.getScreenCTM()
      if (!screen) return
      const matrix = [screen.a, screen.b, screen.c, screen.d, screen.e, screen.f]
      root.current.setAttribute('transform', `matrix(${matrix.join(' ')})`)
      const inverse = affine.invert(matrix)
      root.current
        .querySelectorAll('[data-geometry-chrome]')
        .forEach((chrome) =>
          chrome.setAttribute('transform', `matrix(${[...inverse.slice(0, 4), 0, 0].join(' ')})`)
        )
      const canvas = sourceSvg.closest('.slide-canvas')
      if (canvas) {
        const bounds = canvas.getBoundingClientRect()
        const view = sourceSvg.ownerDocument.defaultView
        root.current.ownerSVGElement.style.clipPath =
          `inset(${bounds.top}px ${view.innerWidth - bounds.right}px ` +
          `${view.innerHeight - bounds.bottom}px ${bounds.left}px)`
      }
    }
    position()
    const view = sourceSvg.ownerDocument.defaultView
    const observer = new view.MutationObserver(position)
    for (let node = sourceSvg; node; node = node.parentElement)
      observer.observe(node, { attributes: true, attributeFilter: ['inert'] })
    view.addEventListener('resize', position)
    view.addEventListener('scroll', position, true)
    return () => {
      observer.disconnect()
      view.removeEventListener('resize', position)
      view.removeEventListener('scroll', position, true)
    }
  }, [sourceSvg, geometry, element])
  if (!sourceSvg) return null
  return createPortal(
    <svg
      data-geometry-overlay=""
      width="100%"
      height="100%"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 'calc(var(--z-modal-overlay) - 1)',
      }}
    >
      <g ref={root}>{children}</g>
    </svg>,
    sourceSvg.ownerDocument.body
  )
}
