import {
  serializeEducationConfig,
  escapeInlineScript,
} from 'revealjs-shared/src/education/config-serialization.js'
import {
  finiteJavaScriptReferences,
  finiteUrlToken,
  parseJavaScript,
  replaceSourceRanges,
} from './portable-script-parser.js'
import { isPackagedScript, rewritePackagedScript } from './portable-vendor-adapters.js'
import { finiteResponseExpression } from './portable-fetch-adapter.js'
function declared(reference, kind, state, base, context) {
  const url = state.graph.resolve(reference, base, context)
  return state.dependencies?.dynamicResources.some(
    (resource) =>
      resource.kind === kind &&
      state.graph.resolve(resource.url, state.manifestBase, context) === url
  )
}
export async function closeJavaScript(
  source,
  base,
  state,
  context,
  { module = false, packaged = false } = {}
) {
  if (packaged) return rewritePackagedScript(source, base, state, context)
  const ast = parseJavaScript(source, module, state.graph, base, context)
  const replacements = []
  for (const ref of finiteJavaScriptReferences(ast)) {
    const finite = finiteUrlToken(ref.token)
    const reference = finite && ref.module ? state.resolveModule(finite.url, base) : finite?.url
    if (ref.forbidden || !reference)
      throw state.graph.error(
        'undeclared',
        reference || base,
        context,
        'Unbounded or online/evaluation JavaScript capability'
      )
    if (ref.dynamic && !declared(reference, ref.kind, state, base, context))
      throw state.graph.error(
        'undeclared',
        state.graph.resolve(reference, base, context),
        context,
        `Dynamic ${ref.kind} dependency is not declared`
      )
    if (ref.call) {
      const node = await state.graph.load(reference, 'connect', base, context)
      replacements.push({
        start: ref.call.start,
        end: ref.call.end,
        value: finiteResponseExpression(node),
      })
      continue
    }
    if (ref.module || ref.worker || ref.kind === 'script') {
      const id = await closeScriptResource(reference, base, state, context, {
        module: ref.module,
        worker: ref.worker,
      })
      let marker = `__NAVSLIDES_RESOURCE_${state.graph.runtimeCounter++}__`
      while (source.includes(marker)) marker += '_'
      const expression =
        module || state.resourceScript
          ? JSON.stringify(marker)
          : `${state.runtimeName}[${JSON.stringify(id)}]`
      replacements.push({
        start: ref.token.start,
        end: ref.token.end,
        value: finite.wrapped ? `new URL(${expression})` : expression,
      })
      if (module || state.resourceScript)
        state.pendingModuleReferences.push({ marker: JSON.stringify(marker), id })
      if (ref.worker) state.capabilities.worker = true
      state.capabilities.scriptBlob = true
    } else {
      if (ref.kind === 'style')
        throw state.graph.error(
          'undeclared',
          reference,
          context,
          'Dynamically inserted stylesheets require inline CSS instead of data/blob stylesheet loading'
        )
      const embedded = await state.graph.embed(reference, ref.kind, base, context)
      replacements.push({
        start: ref.token.start,
        end: ref.token.end,
        value: finite.wrapped ? `new URL(${JSON.stringify(embedded)})` : JSON.stringify(embedded),
      })
    }
  }
  return replaceSourceRanges(source, replacements)
}
export async function closeScriptResource(reference, base, state, context, options = {}) {
  const graph = state.graph,
    node = await graph.load(reference, 'script', base, context)
  const next = graph.descend(context, node.url)
  const key = `${options.module ? 'module' : 'classic'}:${node.url}`
  if (state.scriptIds.has(key)) return state.scriptIds.get(key)
  const id = `resource${state.scriptIds.size}`
  // Reserve the identity before descending; the graph chain rejects actual cycles.
  state.scriptIds.set(key, id)
  const references = [],
    nestedState = { ...state, pendingModuleReferences: references, resourceScript: true }
  const source = await closeJavaScript(
    new TextDecoder().decode(node.bytes),
    node.base,
    nestedState,
    next,
    { ...options, packaged: isPackagedScript(node.base, graph) }
  )
  state.scriptRecords.push({ id, code: source, references })
  return id
}
export function runtimeBootstrap(state) {
  if (!state.scriptRecords.length) return ''
  state.capabilities.scriptBlob = true
  const records = serializeEducationConfig(state.scriptRecords)
  return escapeInlineScript(
    `var ${state.runtimeName}={};(function(){var records=${records},urls=[];records.forEach(function(record){var source=record.code;record.references.forEach(function(ref){source=source.split(ref.marker).join(JSON.stringify(${state.runtimeName}[ref.id]));});var url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));${state.runtimeName}[record.id]=url;urls.push(url);});window.addEventListener('pagehide',function(event){if(!event.persisted)urls.forEach(function(url){URL.revokeObjectURL(url);});});})();`
  )
}
export function moduleEntryBootstrap(source, references, state) {
  const code = serializeEducationConfig(source),
    refs = serializeEducationConfig(references)
  return escapeInlineScript(
    `(function(){var source=${code};${refs}.forEach(function(ref){source=source.split(ref.marker).join(JSON.stringify(${state.runtimeName}[ref.id]));});var script=document.createElement('script');script.type='module';script.textContent=source;document.currentScript.replaceWith(script);})();`
  )
}
