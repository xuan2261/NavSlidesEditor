import { describe, expect, it } from 'vitest'
import { generateRevealHTML } from '../src/htmlGenerator.js'

const actionElement = { id: 'action', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 40, fill: '#fff', action: { kind: 'slide', slideId: 'child', label: 'Details' } }

describe('generated action runtime', () => {
  it('[cap:action.element-runtime] maps stable parent and vertical child IDs and delegates keyboard activation', () => {
    const html = generateRevealHTML({ id: 'deck', title: 'Actions', slides: [{ id: 'parent', elements: [actionElement], children: [{ id: 'child', elements: [] }] }] })
    expect(html).toContain('"parent":[0,0]')
    expect(html).toContain('"child":[0,1]')
    expect(html).toContain("document.addEventListener('click'")
    expect(html).toContain("event.key !== 'Enter' && event.key !== ' '")
    expect(html).toContain("window.open(action.url, '_blank', 'noopener,noreferrer')")
    expect(html).toContain('Action destination is unavailable.')
  })
})
