// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import renderer from '../../shared/src/element-renderers.js'
import groups from '../../shared/src/pptx-semantic-groups.js'
import { compactSemanticGraph } from '../../shared/src/pptx-semantic-source-graph.js'

const source = (nativeId) => ({
  partUri: 'ppt/slides/slide1.xml',
  nativeId,
  preconditionHash: 'a'.repeat(64),
})
function fixture() {
  const definition = (id, kind) => ({ id, kind, source: source(id), components: [], content: {} })
  const instance = (id, definitionId, parentInstanceId, localTransform, paintIndex) => ({
    id,
    definitionId,
    parentInstanceId,
    localTransform,
    paintIndex,
    slideId: 's',
    overrides: {},
  })
  const model = {
    schemaVersion: 1,
    styles: {},
    fonts: {},
    definitions: {
      group: definition('group', 'group'),
      nested: definition('nested', 'group'),
      text: definition('text', 'text'),
    },
    instances: {
      g: instance('g', 'group', null, [2, 0, 1, 3, -9525, 19050], 0),
      n: instance('n', 'nested', 'g', [0, 1, -1, 0, 0, 0], 1),
      leaf: instance('leaf', 'text', 'n', [1, 0, 0, 1, 9525, 0], 2),
    },
  }
  const slide = {
    id: 's',
    elements: [
      {
        id: 'el',
        type: 'text',
        pptxInstanceId: 'leaf',
        x: 999,
        y: 999,
        rotation: 45,
        width: 120,
        height: 40,
        content: '<p>Editable</p>',
      },
    ],
  }
  return { model, slide }
}
function render(model, slide) {
  const root = document.createElement('div')
  root.innerHTML = renderer.renderSlideElements(slide, { pptxSemantic: model, forPrint: true })
  return root
}

describe('generated semantic matrix hierarchy', () => {
  it('keeps composite opacity once on the shared generated paint ancestor through ungroup and regroup', () => {
    const { model, slide } = fixture()
    model.definitions.group.content.opacity = 0.5
    const before = render(model, slide)
    const ungrouped = groups.ungroupSemanticInstance(model, 'g')
    const after = render(ungrouped, slide)
    expect(after.innerHTML).toBe(before.innerHTML)
    expect(after.querySelector('[data-pptx-instance-id="g"]').style.opacity).toBe('0.5')
    expect(after.querySelector('[data-pptx-instance-id="n"]').style.opacity).toBe('1')
    expect(after.querySelector('[data-pptx-instance-id="leaf"]').style.opacity).toBe('')
    expect(after.querySelectorAll('[style*="opacity:0.5"]')).toHaveLength(1)
    const regrouped = groups.regroupSemanticInstance(ungrouped, 'g', ['n'])
    expect(render(regrouped, slide).innerHTML).toBe(before.innerHTML)
  })
  it('renders real nested local matrices without a second legacy box transform', () => {
    const { model, slide } = fixture()
    const root = render(model, slide)
    const group = root.querySelector('[data-pptx-instance-id="g"]')
    const nested = group.querySelector(':scope > [data-pptx-instance-id="n"]')
    const leaf = nested.querySelector(':scope > [data-pptx-instance-id="leaf"]')
    expect(group.style.transform).toBe('matrix(2,0,1,3,-1,2)')
    expect(nested.style.transform).toBe('matrix(0,1,-1,0,0,0)')
    expect(leaf.style.transform).toBe('matrix(1,0,0,1,1,0)')
    expect(leaf.textContent).toBe('Editable')
    expect(leaf.firstElementChild.style.left).toBe('0px')
    expect(leaf.firstElementChild.style.transform).not.toContain('rotate')
    expect(slide.elements[0].x).toBe(999)
  })
  it('rejects missing or duplicate instance-linked leaves instead of silently dropping them', () => {
    const { model, slide } = fixture()
    expect(() => render(model, { ...slide, elements: [] })).toThrow()
    expect(() =>
      render(model, {
        ...slide,
        elements: [...slide.elements, { ...slide.elements[0], id: 'other' }],
      })
    ).toThrow()
  })
  it('retains the legacy render route when no semantic model is present', () => {
    const { slide } = fixture()
    const root = document.createElement('div')
    root.innerHTML = renderer.renderSlideElements(slide, { forPrint: true })
    expect(root.querySelector('[data-pptx-instance-id]')).toBe(null)
    expect(root.firstElementChild.style.left).toBe('999px')
    expect(root.firstElementChild.style.transform).toContain('rotate(45deg)')
  })
  it('honors explicit semantic visibility over a stale derived hidden field', () => {
    const { model, slide } = fixture()
    slide.elements[0].hidden = true
    model.instances.leaf.overrides.hidden = false
    expect(render(model, slide).textContent).toBe('Editable')
    model.instances.g.overrides.hidden = true
    expect(render(model, slide).textContent).toBe('')
  })
  it('rejects non-container descendants rather than consuming and dropping their render leaf', () => {
    const { model, slide } = fixture()
    model.instances.extra = {
      ...model.instances.leaf,
      id: 'extra',
      parentInstanceId: 'leaf',
      paintIndex: 3,
    }
    slide.elements.push({ ...slide.elements[0], id: 'extra-el', pptxInstanceId: 'extra' })
    expect(() => render(model, slide)).toThrow()
  })

  it('renders correctly for schemaVersion 3 models using canonical accessors', () => {
    const { model, slide } = fixture()
    const schema3 = compactSemanticGraph(model)
    const root = render(schema3, slide)
    expect(root.textContent).toBe('Editable')
    expect(root.querySelector('[data-pptx-instance-id="leaf"]')).not.toBeNull()
  })
})
