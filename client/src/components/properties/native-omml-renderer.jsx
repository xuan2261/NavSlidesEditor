import React from 'react'
import renderer from 'revealjs-shared/src/pptx-omml-renderer.js'
import ommlRuntime from 'revealjs-shared/src/pptx-omml-runtime.js'
import { usePptxSourceFonts } from '../../hooks/use-pptx-source-fonts.js'

export default function NativeOmmlRenderer({ document, runtime, onSelect, mathFrame, textDefaults, theme, inline = false }) {
  const sourceFonts = usePptxSourceFonts()
  let result
  try {
    let active = runtime ?? sourceFonts.fontRuntime
    if (!active) throw new TypeError(`Source-matching equation font runtime ${sourceFonts.status}`)
    if (active.getFontAsset) active = ommlRuntime.createOmmlRuntime({
      document: globalThis.document, fontRuntime: active, mathFrame, textDefaults, theme, sourceStyle: true,
    })
    result = active.render ? active.render(document) : renderer.renderOmmlDocument(document, active)
  } catch (error) {
    const ErrorTag = inline ? 'span' : 'p'
    return <ErrorTag role="alert" data-component-id={error.componentId}>{error.message}</ErrorTag>
  }
  const Tag = inline ? 'span' : 'div'
  return <Tag style={inline
    ? { display: 'inline-block', verticalAlign: `${-result.layout.descent}px`, lineHeight: 0 }
    : { maxWidth: '100%', overflow: 'auto' }}
    data-omml-baseline={result.layout.ascent}
    onClick={onSelect ? (event) => {
      const id = event.target.closest('[data-component-id]')?.getAttribute('data-component-id')
      if (id) onSelect(id)
    } : undefined}
    dangerouslySetInnerHTML={{ __html: result.svg }} />
}
