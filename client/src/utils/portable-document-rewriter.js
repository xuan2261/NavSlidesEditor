import {
  validateHtmlDependencies,
  buildSandboxCsp,
} from 'revealjs-shared/src/education/html-sandbox-policy.js'
import {
  escapeInlineScript,
  serializeEducationConfig,
} from 'revealjs-shared/src/education/config-serialization.js'
import { PortableResourceGraph } from './portable-resource-graph.js'
import { rewriteCss, rewriteStyleAttribute } from './portable-css-rewriter.js'
import { safeStyleText } from 'revealjs-shared/src/rich-text-style-sanitizer.js'
import {
  closeJavaScript,
  runtimeBootstrap,
  moduleEntryBootstrap,
} from './portable-script-rewriter.js'
import { isPackagedScript } from './portable-vendor-adapters.js'
import { closeNativeConfig, assertNoLiveAuthority } from './portable-native-config.js'
import { closeElementMedia, ownerContext, portablePolicy } from './portable-element-resources.js'
import { closeFrame, readDependencies } from './portable-frame-rewriter.js'
import { readImportMaps } from './portable-import-map.js'
const executable = (script) =>
  !script.type || /^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(script.type)
async function rewriteDocument(html, base, graph, inherited = {}) {
  if (typeof html !== 'string') throw new TypeError('Portable input must be an HTML string')
  if (new TextEncoder().encode(html).byteLength > graph.limits.maxResourceBytes)
    throw graph.error('size', base, inherited, 'Document bytes exceeded resource budget')
  const document = new DOMParser().parseFromString(html, 'text/html')
  assertNoLiveAuthority(document, graph, inherited)
  const baseElement = document.querySelector('base[href]')
  if (baseElement) base = graph.resolve(baseElement.getAttribute('href'), base, inherited)
  const dependencies = readDependencies(
    document.documentElement,
    inherited.dependencies,
    graph,
    inherited
  )
  const state = {
    graph,
    document,
    dependencies,
    manifestBase: inherited.manifestBase || base,
    runtimeName: `__navslidesPortable${graph.runtimeCounter++}`,
    scriptIds: new Map(),
    scriptRecords: [],
    pendingModuleReferences: [],
    capabilities: { scriptBlob: false, connect: false, worker: false },
  }
  state.resolveModule = readImportMaps(document, base, graph, inherited)
  const scripts = [...document.querySelectorAll('script')]
  const authoredScript =
    scripts.some(executable) ||
    [...document.querySelectorAll('*')].some((element) =>
      [...element.attributes].some((attribute) => /^on/i.test(attribute.name))
    )
  const isSandboxWrapper = document.documentElement.hasAttribute('data-ns-sandbox-container')
  const compilerDocument = inherited.framed
    ? inherited.generatedFrame === true
    : inherited.generatedDocument === true
  if (isSandboxWrapper && !inherited.framed)
    throw graph.error(
      'manifest',
      base,
      inherited,
      'data-ns-sandbox-container cannot be used on root author document'
    )
  if (authoredScript && !dependencies && !compilerDocument && !isSandboxWrapper) {
    throw graph.error(
      'manifest',
      base,
      inherited,
      'Scripted authored HTML requires an explicit offline declaration'
    )
  }
  if (dependencies) {
    for (const resource of [...dependencies.resources, ...dependencies.dynamicResources])
      await graph.load(resource.url, resource.kind, state.manifestBase, inherited)
  }
  // Only the compiler-added leading policy can be replaced after capability closure.
  const policies = [...document.querySelectorAll('meta[http-equiv]')].filter(
    (meta) => meta.httpEquiv.toLowerCase() === 'content-security-policy'
  )
  const compilerPolicy = policies[0]?.content
  const managedPolicy =
    compilerPolicy === buildSandboxCsp(dependencies, { baseUrl: base }) ||
    compilerPolicy === buildSandboxCsp(dependencies, { baseUrl: base, portable: true })
  for (const element of [...document.querySelectorAll('*')]) {
    if (!element.isConnected) continue
    const context = ownerContext(element, inherited)
    if (['iframe', 'object', 'embed'].includes(element.localName)) {
      const generatedFrame =
        element.localName === 'iframe' &&
        inherited.generatedDocument === true &&
        !inherited.framed &&
        element.hasAttribute('data-ns-generated-frame')
      let frame = element
      if (element.localName !== 'iframe') {
        frame = document.createElement('iframe')
        for (const attribute of element.attributes)
          frame.setAttribute(attribute.name, attribute.value)
        frame.removeAttribute('type')
        if (element.hasAttribute('data')) frame.setAttribute('src', element.getAttribute('data'))
        element.replaceWith(frame)
      }
      await closeFrame(frame, base, state, { ...context, generatedFrame }, rewriteDocument)
      continue
    }
    if (element.localName === 'link') {
      const rel = (element.getAttribute('rel') || '').toLowerCase().split(/\s+/)
      const href = element.getAttribute('href')
      if (rel.includes('stylesheet') && href) {
        const node = await graph.load(href, 'style', base, context)
        const css = await rewriteCss(
          new TextDecoder().decode(node.bytes),
          node.base,
          graph,
          graph.descend(context, node.url)
        )
        const style = document.createElement('style')
        if (element.media) style.media = element.media
        style.textContent = safeStyleText(css)
        element.replaceWith(style)
      } else if (href && rel.includes('icon'))
        element.setAttribute('href', await graph.embed(href, 'image', base, context))
      else if (
        rel.some((value) =>
          ['preconnect', 'dns-prefetch', 'modulepreload', 'preload', 'prefetch'].includes(value)
        )
      ) {
        if (href && !['preconnect', 'dns-prefetch'].some((value) => rel.includes(value))) {
          const kind =
            {
              script: 'script',
              style: 'style',
              image: 'image',
              font: 'font',
              audio: 'media',
              video: 'media',
              fetch: 'connect',
            }[element.getAttribute('as')] || (rel.includes('modulepreload') ? 'script' : 'connect')
          await graph.load(href, kind, base, context)
        }
        element.remove()
      } else if (href) throw graph.error('undeclared', href, context, 'Unsupported linked resource')
    } else if (element.localName === 'style')
      element.textContent = safeStyleText(
        await rewriteCss(element.textContent, base, graph, context)
      )
    else if (element.localName === 'script') {
      if (element.matches('[data-ns-game-config],.nav-game-config'))
        await closeNativeConfig(element, base, graph, context)
      else if (executable(element)) {
        let source = element.textContent,
          scriptBase = base,
          packaged = false,
          next = context
        if (element.src) {
          const node = await graph.load(element.getAttribute('src'), 'script', base, context)
          source = new TextDecoder().decode(node.bytes)
          scriptBase = node.base
          next = graph.descend(context, node.url)
          packaged = isPackagedScript(node.base, graph)
        }
        const trusted =
          !inherited.framed &&
          inherited.generatedDocument &&
          element.getAttribute('data-navslides-runtime') === 'local'
        const references = [],
          scriptState = { ...state, pendingModuleReferences: references }
        source = trusted
          ? source
          : await closeJavaScript(source, scriptBase, scriptState, next, {
              module: element.type === 'module',
              packaged,
            })
        if (element.type === 'module' && references.length) {
          source = moduleEntryBootstrap(source, references, state)
          element.removeAttribute('type')
        }
        element.removeAttribute('src')
        element.removeAttribute('integrity')
        element.removeAttribute('crossorigin')
        element.textContent = escapeInlineScript(source)
      }
    }
    if (element.hasAttribute('style'))
      element.setAttribute(
        'style',
        await rewriteStyleAttribute(element.getAttribute('style'), base, graph, context)
      )
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name)) {
        if (!dependencies && !compilerDocument)
          throw graph.error(
            'manifest',
            base,
            context,
            'Inline event handlers need an offline declaration'
          )
        element.setAttribute(
          attribute.name,
          await closeJavaScript(
            `function handler(event){${attribute.value}\n}`,
            base,
            state,
            context
          ).then((source) => source.slice(source.indexOf('{') + 1, source.lastIndexOf('}')))
        )
      }
      if (['href', 'action'].includes(attribute.name) && /^javascript:/i.test(attribute.value))
        throw graph.error(
          'undeclared',
          attribute.value,
          context,
          'Executable navigation cannot be certified'
        )
    }
    await closeElementMedia(element, base, graph, context)
  }
  document.querySelectorAll('base').forEach((element) => element.remove())
  document.querySelectorAll('meta[http-equiv="refresh" i]').forEach((meta) => {
    throw graph.error(
      'undeclared',
      meta.content,
      inherited,
      'Network document refresh is not portable'
    )
  })
  const bootstrap = runtimeBootstrap(state)
  if (bootstrap) {
    const script = document.createElement('script')
    script.textContent = bootstrap
    document.head.prepend(script)
  }
  graph.capabilities = {
    scriptBlob: graph.capabilities?.scriptBlob || state.capabilities.scriptBlob,
    worker: graph.capabilities?.worker || state.capabilities.worker,
    connect: false,
  }
  if (managedPolicy) policies[0].remove()
  const policy = document.createElement('meta')
  const tikzWasm =
    (!inherited.framed && inherited.generatedDocument === true && graph.compilerWasm === true) ||
    (inherited.framed === true &&
      inherited.generatedFrame === true &&
      state.capabilities.tikzWasm === true)
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = portablePolicy({ ...graph.capabilities, tikzWasm })
  document.head.prepend(policy)
  for (const script of document.querySelectorAll('script:not([src])')) {
    if (!executable(script)) {
      if (/json/i.test(script.type)) {
        try {
          script.textContent = serializeEducationConfig(JSON.parse(script.textContent))
        } catch (error) {
          throw graph.error('parse', base, inherited, error.message)
        }
      } else script.textContent = escapeInlineScript(script.textContent)
    }
  }
  return `<!doctype html>\n${document.documentElement.outerHTML}`
}
export async function generatePortableDocument(html, options = {}) {
  const graph = new PortableResourceGraph(options)
  let dependencies
  try {
    dependencies = validateHtmlDependencies(options.htmlDependencies)
  } catch (error) {
    throw graph.error('manifest', graph.baseUrl, {}, error.message)
  }
  const output = await rewriteDocument(html, graph.baseUrl, graph, {
    dependencies,
    generatedDocument: options.generatedDocument === true,
    chain: [],
  })
  return { html: output, receipt: await graph.receipt() }
}
