// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import GeometryPointOverlay from '../../client/src/components/canvas/element-renderers/geometry-point-overlay'

afterEach(() => {
  cleanup()
  document.querySelectorAll('[data-point-test-workspace]').forEach((node) => node.remove())
})

function fixture(inert = false) {
  const workspace = document.createElement('div')
  workspace.setAttribute('data-point-test-workspace', '')
  if (inert) workspace.setAttribute('inert', '')
  const source = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  source.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
  workspace.appendChild(source)
  document.body.appendChild(workspace)
  render(
    <GeometryPointOverlay sourceSvg={source}>
      <circle data-geometry-chrome="" />
    </GeometryPointOverlay>
  )
  return { workspace, overlay: document.querySelector('svg[data-geometry-overlay]') }
}

it('keeps a body portal hidden and inert when its source canvas is inert', () => {
  const { overlay } = fixture(true)
  expect(overlay.hasAttribute('inert')).toBe(true)
  expect(overlay.style.visibility).toBe('hidden')
})

it('restores the same portal when the workspace overlay closes', async () => {
  const { workspace, overlay } = fixture()
  async function changeInert(expected) {
    const changed = new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (
          overlay.hasAttribute('inert') === expected &&
          overlay.style.visibility === (expected ? 'hidden' : '')
        ) {
          observer.disconnect()
          resolve()
        }
      })
      observer.observe(overlay, { attributes: true, attributeFilter: ['inert', 'style'] })
    })
    await act(async () => {
      workspace.toggleAttribute('inert', expected)
      await changed
    })
  }
  await changeInert(true)
  expect(overlay.hasAttribute('inert')).toBe(true)
  await changeInert(false)
  expect(document.querySelector('svg[data-geometry-overlay]')).toBe(overlay)
  expect(overlay.hasAttribute('inert')).toBe(false)
  expect(overlay.style.visibility).toBe('')
})
