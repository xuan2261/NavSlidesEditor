import { renderSemanticTable } from 'revealjs-shared/src/pptx-table-renderer.js'
import { usePptxSourceFonts } from '../hooks/use-pptx-source-fonts'

export default function NativeTableRenderer({ element, tableRuntime }) {
  const { fontRuntime } = usePptxSourceFonts()
  const runtime = tableRuntime ?? fontRuntime
  let markup
  try {
    if (!runtime) throw new TypeError('Source-matching font measurement is unavailable')
    markup = renderSemanticTable(element.tableDocument, runtime)
  } catch (error) {
    return <div role="alert" data-component-id={error.componentId || element.tableDocument.componentId}
      data-render-error={error.code} data-render-path={error.path}>
      {error.message}
    </div>
  }
  return <div data-native-table-surface={element.tableDocument.componentId}
    style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: markup }} />
}
