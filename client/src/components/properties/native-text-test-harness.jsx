import { useState } from 'react'
import { render } from '@testing-library/react'
import NativeInheritanceTextProperties from './native-inheritance-text-properties'
import { useEditorElementController } from '../../hooks/editor-controller/use-editor-element-controller'
import { geometryProjectionFixture } from '../../../../tests/pptx-semantic/geometry-projection-fixture.js'
import { geometryStyleFixture } from '../../../../tests/pptx-semantic/geometry-style-fixture.js'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'

export function nativeTextFixture(customize) {
  const presentation = { ...geometryProjectionFixture(), pptxSemantic: geometryStyleFixture() }
  const definition = presentation.pptxSemantic.definitions.definition
  definition.components.push(...['body', 'paragraph', 'label', 'suffix', 'other', 'other-run'].map((id, index) => ({
    id, kind: index === 0 ? 'property' : ['paragraph', 'other'].includes(id) ? 'paragraph' : 'run',
    locator: { path: [0, 0, 5 + index], preconditionHash: definition.source.preconditionHash },
  })))
  definition.content.textDocument = {
    schemaVersion: 1, componentId: 'body',
    body: { verticalText: 'mongolianVert' },
    paragraphs: [{ componentId: 'paragraph', runs: [
      { componentId: 'label', kind: 'text', text: 'Source label', proofing: { dirty: false } },
      { componentId: 'suffix', kind: 'text', text: ' suffix', properties: {
        underline: 'wavyDbl', color: { kind: 'scheme', value: 'accent1', transforms: [{ kind: 'tint', value: 20000 }] },
      } },
    ] }, { componentId: 'other', properties: { alignment: 'thaiDist' }, runs: [
      { componentId: 'other-run', kind: 'text', text: 'Unchanged', properties: { kumimoji: true } },
    ] }],
  }
  if (customize) customize(presentation)
  return semantic.normalizeSemanticPresentation(presentation)
}

export function mountNativeText(initial = nativeTextFixture(), reject) {
  let latest = initial
  function Inspector() {
    const [presentation, setPresentation] = useState(initial)
    latest = presentation
    const slide = presentation.slides[0]
    const controller = useEditorElementController({
      presentation, activeSlide: slide, editingElementIdRef: { current: null }, setPresentation,
      mapActive: (previous, transform) => ({
        ...previous, slides: [transform(previous.slides[0]), ...previous.slides.slice(1)],
      }),
    })
    return <NativeInheritanceTextProperties presentation={presentation} slide={slide}
      element={slide.elements[0]} onUpdate={reject ? ((patch) => reject(patch)) : ((patch) => controller.updateElement('i1', patch))} />
  }
  return { ...render(<Inspector />), initial, latest: () => latest }
}
export const savedText = (view) => view.latest().pptxSemantic.instances.i1
  .overrides.components.body.textDocument
