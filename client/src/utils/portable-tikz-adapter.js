import {
  TIKZ_RUNTIME_VERSION,
  TIKZ_RUNTIME_REVISION,
  TIKZ_PUBLISHED_HASHES,
  TIKZ_RESOURCE_INVENTORY_SHA256,
} from 'revealjs-shared/src/tikz-runtime-contract.js'
import { serializeEducationConfig } from 'revealjs-shared/src/education/config-serialization.js'
import { bytesToDataUrl } from './portable-resource-bytes.js'
import { parseJavaScript, walkJavaScript } from './portable-script-parser.js'
const encoder = new TextEncoder()
async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
function replaceOnce(source, before, after, fail) {
  const at = source.indexOf(before)
  if (at < 0 || source.indexOf(before, at + before.length) >= 0)
    throw fail('TikZ compiler adapter does not match the pinned publication')
  return source.slice(0, at) + after + source.slice(at + before.length)
}
// This function is serialized into the real compiler worker, not installed as a window fetch proxy.
function readCompilerResource(resources, input) {
  if (typeof input !== 'string' || !Object.hasOwn(resources, input)) {
    return Promise.reject(
      new Error('TikZ resource is outside the packaged compiler map: ' + String(input))
    )
  }
  const binary = atob(resources[input])
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return Promise.resolve(new Response(bytes, { headers: { 'content-type': 'application/gzip' } }))
}
export async function rewriteTikzScript(source, base, state, context) {
  const graph = state.graph
  const fail = (detail) => graph.error('undeclared', base, context, detail)
  if (context.framed !== true || context.generatedFrame !== true)
    throw fail('TikZ Wasm is reserved for generated native compiler frames')
  const root = new URL('./', base).href
  if ((await sha256(encoder.encode(source))) !== TIKZ_PUBLISHED_HASHES['tikzjax.js'])
    throw fail('Unrecognized TikZ publication bytes')
  const node = await graph.load('runtime-manifest.json', 'connect', base, context)
  let manifest
  try {
    manifest = JSON.parse(new TextDecoder().decode(node.bytes))
  } catch (error) {
    throw fail(`Invalid TikZ manifest: ${error.message}`)
  }
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.package !== '@drgrice1/tikzjax' ||
    manifest.version !== TIKZ_RUNTIME_VERSION ||
    manifest.revision !== TIKZ_RUNTIME_REVISION ||
    !Array.isArray(manifest.resources) ||
    manifest.resources.length !== 326
  )
    throw fail('Unsupported TikZ compiler manifest')
  const inventory = manifest.resources
    .map((row) => {
      if (
        !row ||
        typeof row.path !== 'string' ||
        !/^(?:core\.dump\.gz|tex\.wasm\.gz|fonts\.css|tex_files\/[\w.-]+\.gz|fonts\/[\w.-]+\.woff2)$/.test(
          row.path
        ) ||
        typeof row.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(row.sha256)
      )
        throw fail('Invalid packaged TikZ resource')
      return { path: row.path, sha256: row.sha256 }
    })
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  if ((await sha256(encoder.encode(JSON.stringify(inventory)))) !== TIKZ_RESOURCE_INVENTORY_SHA256)
    throw fail('Unrecognized TikZ resource inventory')
  const worker = await graph.load('run-tex.js', 'script', base, context)
  if ((await sha256(worker.bytes)) !== TIKZ_PUBLISHED_HASHES['run-tex.js'])
    throw fail('Unrecognized TikZ compiler worker bytes')
  const resources = Object.create(null)
  await Promise.all(
    inventory.map(async (row) => {
      const asset = await graph.load(row.path, 'connect', base, context)
      if (asset.base !== new URL(row.path, root).href || (await sha256(asset.bytes)) !== row.sha256)
        throw fail(`Changed TikZ resource: ${row.path}`)
      if (row.path.endsWith('.gz'))
        resources[new URL(row.path, root).href] = bytesToDataUrl(
          asset.bytes,
          'application/gzip'
        ).split(',')[1]
    })
  )
  let workerCode = new TextDecoder().decode(worker.bytes)
  // Only beta24's audited decompression GET is redirected. Its URL fallback was removed at publication.
  workerCode = replaceOnce(workerCode, 'fetch(`${a}/${A}`)', '__nsTikzRead(`${a}/${A}`)', fail)
  const ast = parseJavaScript(workerCode, false, graph, worker.base, context)
  walkJavaScript(ast, (expression) => {
    if (
      (expression.type === 'NewExpression' && expression.callee.name === 'Function') ||
      (expression.type === 'CallExpression' &&
        ['fetch', 'eval', 'importScripts'].includes(expression.callee.name))
    )
      throw fail('Unclosed TikZ worker capability')
  })
  workerCode = `const __nsTikzResources=${serializeEducationConfig(resources)};const __nsTikzRead=(${readCompilerResource.toString()}).bind(null,__nsTikzResources);\n${workerCode}`
  // An inlined script has no src. Retain the canonical absolute publication base explicitly.
  source = replaceOnce(
    source,
    'new URL(document.currentScript.src)',
    `new URL(${JSON.stringify(base)})`,
    fail
  )
  source = replaceOnce(
    source,
    'new o(`${e}/run-tex.js`)',
    'new o(__nsTikzWorker,{CORSWorkaround:false})',
    fail
  )
  state.capabilities.worker = true
  state.capabilities.scriptBlob = true
  state.capabilities.tikzWasm = true
  graph.compilerWasm = true
  return `(function(){const __nsTikzWorker=URL.createObjectURL(new Blob([${serializeEducationConfig(workerCode)}],{type:'text/javascript'}));window.addEventListener('pagehide',event=>{if(!event.persisted)URL.revokeObjectURL(__nsTikzWorker);});\n${source}\n})();`
}
