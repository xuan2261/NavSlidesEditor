// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { familyDocumentsFixture } from './family-documents-fixture'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import { LatexRenderer } from '../../client/src/components/canvas/element-renderers/latex-element-renderer'
import { getElementRenderer } from '../../client/src/components/canvas/element-renderers/registry'

const calls = vi.hoisted(() => ({ math: [], diagram: [], editor: [] }))
vi.mock('../../client/src/components/properties/native-omml-renderer.jsx', () => ({
  default: (props) => {
    calls.math.push(props)
    return <span data-testid="source-math" />
  },
}))
vi.mock('../../client/src/components/native-smartart/native-smartart-renderer.jsx', () => ({
  NativeSmartArtRenderer: (props) => {
    calls.diagram.push(props)
    return <span data-testid="source-diagram" />
  },
  smartArtFailureMessage: (error) => error.message,
}))
vi.mock('../../client/src/components/properties/native-omml-editor.jsx', () => ({
  default: (props) => {
    calls.editor.push(props)
    return (
      <button
        disabled={props.locked}
        onClick={() =>
          props.onSemanticOperation({
            type: 'omml.edit',
            instanceId: props.instanceId,
            componentId: props.document.root.componentId,
            command: { type: 'reset' },
          })
        }
      >
        Native math reset
      </button>
    )
  },
}))
vi.mock('../../client/src/components/native-smartart/native-smartart-editor.jsx', () => ({
  NativeSmartArtEditor: (props) => {
    calls.editor.push(props)
    return (
      <button
        disabled={props.disabled}
        onClick={() =>
          props.onSemanticOperation({
            type: 'smartart.edit',
            instanceId: props.instanceId,
            componentId: props.document.componentId,
            command: { type: 'reset' },
          })
        }
      >
        Native diagram reset
      </button>
    )
  },
}))
afterEach(() => {
  cleanup()
  calls.math.length = calls.diagram.length = calls.editor.length = 0
})

async function fixture(kind) {
  const document = (await familyDocumentsFixture())[kind]
  const definition = Object.values(document.definitions)[0]
  definition.content.extent = { cx: 9144000, cy: 4572000 }
  if (kind === 'equation')
    definition.content.mathFrame = {
      paragraph: { defaultRunProperties: { fontLatin: { typeface: 'Cambria Math' } } },
    }
  const element = familyCompatibilityElement(document, {
    id: 'e',
    type: kind === 'equation' ? 'latex' : 'diagram',
    pptxInstanceId: 'occurrence',
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    mathFrame: { forged: true },
    pptxFamilyBounds: { width: 1, height: 1 },
  })
  return { document, definition, element }
}

describe('canonical family canvas and inspector registration', () => {
  it('derives physical bounds and math frame from source, not mutable compatibility fields', async () => {
    const { document, definition, element } = await fixture('equation')
    expect(element.mathFrame).toEqual(definition.content.mathFrame)
    expect(element.pptxFamilyBounds).toEqual({ x: 0, y: 0, width: 9144000, height: 4572000 })
    const withoutFrame = JSON.parse(JSON.stringify(document))
    delete withoutFrame.definitions[definition.id].content.mathFrame
    expect(familyCompatibilityElement(withoutFrame, element).mathFrame).toBeUndefined()
  })
  it('routes source equations without a TeX iframe and forwards their frame', async () => {
    const { element } = await fixture('equation')
    const view = render(<LatexRenderer element={element} />)
    expect(screen.getByTestId('source-math')).toBeTruthy()
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(calls.math.at(-1)).toMatchObject({
      document: element.ommlDocument,
      mathFrame: element.mathFrame,
    })
    view.unmount()
    render(<LatexRenderer element={{ type: 'latex', content: 'x^2' }} />)
    expect(screen.getByTitle('LaTeX / TikZ')).toBeTruthy()
  })
  it('registers SmartArt on its physical authored frame, not percentage dimensions', async () => {
    const { element } = await fixture('diagram')
    const Renderer = getElementRenderer('diagram')
    expect(Renderer).toBeTypeOf('function')
    render(<Renderer element={element} />)
    expect(screen.getByTestId('source-diagram')).toBeTruthy()
    expect(calls.diagram.at(-1)).toMatchObject({
      document: element.smartArtDocument,
      bounds: { x: 0, y: 0, width: 9144000, height: 4572000 },
    })
  })
  it.each(['equation', 'diagram'])(
    'routes %s inspector intents through the existing projection boundary',
    async (kind) => {
      const { document, element } = await fixture(kind)
      const update = vi.fn()
      const label = kind === 'equation' ? 'Native math reset' : 'Native diagram reset'
      const props = {
        selectedElement: element,
        selectedElementIds: ['e'],
        slide: { id: 's1', elements: [element] },
        presentation: { pptxSemantic: document },
        onUpdateElement: update,
      }
      const view = render(<PropertiesPanel {...props} />)
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(update).toHaveBeenCalledWith('e', {
        pptxProjectionOperation: {
          type: kind === 'equation' ? 'omml.edit' : 'smartart.edit',
          instanceId: 'occurrence',
          componentId:
            kind === 'equation'
              ? element.ommlDocument.root.componentId
              : element.smartArtDocument.componentId,
          command: { type: 'reset' },
        },
      })
      if (kind === 'equation') expect(calls.editor.at(-1).mathFrame).toEqual(element.mathFrame)
      else expect(calls.editor.at(-1).bounds).toEqual(element.pptxFamilyBounds)
      update.mockClear()
      view.rerender(<PropertiesPanel {...props} slide={{ ...props.slide, locked: true }} />)
      const button = screen.getByRole('button', { name: label })
      expect(button.disabled).toBe(true)
      fireEvent.click(button)
      expect(update).not.toHaveBeenCalled()
      view.rerender(<PropertiesPanel {...props} selectedElementIds={['e', 'other']} />)
      expect(screen.getByRole('button', { name: label }).disabled).toBe(true)
    }
  )
})
