// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorNavigator from '../../client/src/components/editor/editor-navigator'

const U = 914400 / 96
function fixture() {
  const definition = (id, kind) => ({
    id,
    kind,
    components: [],
    source: { partUri: 'ppt/slides/slide1.xml', nativeId: id, preconditionHash: 'a'.repeat(64) },
    content: { extent: { cx: 80 * U, cy: 40 * U } },
  })
  const instance = (id, definitionId, slideId, parentInstanceId, matrix) => ({
    id,
    definitionId,
    slideId,
    parentInstanceId,
    localTransform: matrix,
    paintIndex: 0,
    overrides: {},
  })
  const element = (id, pptxInstanceId) => ({
    id,
    pptxInstanceId,
    type: 'shape',
    shape: 'rect',
    fill: '#ff0000',
    x: 999,
    y: 999,
    rotation: 45,
    width: 80,
    height: 40,
  })
  return {
    resolution: { width: 960, height: 540 },
    slides: [
      {
        id: 's',
        elements: [element('e', 'leaf')],
        children: [{ id: 'child', elements: [element('child-e', 'child-leaf')] }],
      },
    ],
    pptxSemantic: {
      schemaVersion: 1,
      styles: {},
      fonts: {},
      definitions: {
        group: { ...definition('group', 'group'), content: { opacity: 0.5 } },
        shape: definition('shape', 'shape'),
      },
      instances: {
        g: instance('g', 'group', 's', null, [2, 0, 1, 1, U, 2 * U]),
        leaf: instance('leaf', 'shape', 's', 'g', [-1, 0, 0, 1, 80 * U, 0]),
        'child-g': instance('child-g', 'group', 'child', null, [1, 0, 0, 1, 10 * U, 20 * U]),
        'child-leaf': instance('child-leaf', 'shape', 'child', 'child-g', [1, 0, 0, 1, 0, 0]),
      },
    },
  }
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('actual navigator semantic thumbnails', () => {
  it('passes parent and vertical-child model context, retaining local matrices and composite opacity', () => {
    const presentation = fixture()
    const { container } = render(
      <EditorNavigator
        visible
        c={{
          presentation,
          currentSlideIndex: 0,
          availableLayouts: [],
          navigateToSlide: vi.fn(),
        }}
      />
    )
    const group = container.querySelector('[data-thumbnail-instance-id="g"]')
    expect(group).not.toBeNull()
    expect(group.style.transform).toBe('matrix(2,0,1,1,1,2)')
    expect(group.style.opacity).toBe('0.5')
    const leaf = group.querySelector('[data-thumbnail-instance-id="leaf"]')
    expect(leaf.style.transform).toBe('matrix(-1,0,0,1,80,0)')
    expect(leaf.firstElementChild.style.left).toBe('0px')
    expect(leaf.firstElementChild.style.transform).not.toContain('rotate')
    const child = container.querySelector('[data-thumbnail-instance-id="child-g"]')
    expect(child.style.transform).toBe('matrix(1,0,0,1,10,20)')
    expect(child.style.opacity).toBe('0.5')
    expect(presentation.slides[0].elements[0].x).toBe(999)
  })
})
