import {
  validateHtmlDependencies,
  buildSandboxFrameDocument,
} from 'revealjs-shared/src/education/html-sandbox-policy.js'
export function readDependencies(element, inherited, graph, context) {
  if (!element.hasAttribute('data-html-dependencies')) return inherited
  try {
    return validateHtmlDependencies(JSON.parse(element.getAttribute('data-html-dependencies')))
  } catch (error) {
    throw graph.error('manifest', graph.baseUrl, context, error.message)
  }
}
export async function closeFrame(element, base, state, context, rewriteDocument) {
  const graph = state.graph
  element.setAttribute('sandbox', 'allow-scripts')
  const dependencies = readDependencies(element, state.dependencies, graph, context)
  let html,
    nestedBase = base,
    next = context
  const pdf = element.getAttribute('data-pdf-iframe')
  const deferred = element.hasAttribute('data-ns-srcdoc')
  const srcdoc = deferred ? element.getAttribute('data-ns-srcdoc') : element.getAttribute('srcdoc')
  const pluginSource = element.getAttribute('data-plugin-src')
  const reference = pluginSource || element.getAttribute('src') || element.getAttribute('data')
  if (
    pluginSource &&
    (!element.hasAttribute('data-html-dependencies') || !dependencies?.offlineCapable)
  ) {
    throw graph.error(
      'manifest',
      pluginSource,
      context,
      'Plugin source needs an explicit offline dependency manifest'
    )
  }
  if (pdf !== null) {
    try {
      html = decodeURIComponent(pdf)
    } catch (error) {
      throw graph.error('decode', base, context, error.message)
    }
    element.removeAttribute('data-pdf-iframe')
    next = graph.descend(context, `pdf-document:${graph.runtimeCounter++}`)
  } else if (srcdoc !== null) {
    html = srcdoc
    next = graph.descend(context, `srcdoc:${graph.runtimeCounter++}`)
  } else if (reference && reference !== 'about:blank') {
    const node = await graph.load(reference, 'frame', base, context)
    if (node.mime === 'application/pdf') {
      element.setAttribute('src', await graph.embed(reference, 'frame', base, context))
      element.removeAttribute('srcdoc')
      return
    }
    html = new TextDecoder().decode(node.bytes)
    nestedBase = /^(?:data:|blob:)/i.test(node.base) ? base : node.base
    next = graph.descend(context, node.url)
  } else return
  const manifestBase = element.hasAttribute('data-html-dependencies')
    ? undefined
    : state.manifestBase
  // Compiler authority belongs only to marked inline frames in the generated root.
  // Never inherit it into descendants, URL documents, plugin wrappers or PDF frames.
  const generatedFrame =
    context.generatedFrame === true && srcdoc !== null && pdf === null && !pluginSource
  const closed = await rewriteDocument(html, nestedBase, graph, {
    ...next,
    dependencies,
    manifestBase,
    framed: true,
    generatedDocument: false,
    generatedFrame,
  })
  element.removeAttribute('src')
  element.removeAttribute('data')
  element.removeAttribute('srcdoc')
  if (pluginSource) {
    element.removeAttribute('data-plugin-src')
    element.setAttribute(
      'data-ns-srcdoc',
      buildSandboxFrameDocument(closed, dependencies, { plugin: true, portable: true })
    )
  } else element.setAttribute(deferred ? 'data-ns-srcdoc' : 'srcdoc', closed)
}
