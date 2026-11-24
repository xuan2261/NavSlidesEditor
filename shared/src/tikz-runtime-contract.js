const TIKZ_RUNTIME_VERSION = '1.0.0-beta24'
const TIKZ_RUNTIME_REVISION = 'navslides-lazy-cache-closed-inputs-v1'
const TIKZ_UPSTREAM_HASHES = Object.freeze({
  'tikzjax.js': 'b360666cfc2425180abc5d256c81ea686dee8fe8381ef9a73856cb28bdf3bead',
  'run-tex.js': '45532e94a8aab00edd7a76ddd12f035c1570978be2a87931caed2b2c5c4bc9a7',
})
const TIKZ_PUBLISHED_HASHES = Object.freeze({
  'tikzjax.js': '1d2a51a9f66f76a91d3db01cd0a2fb997a10cca10b71e147282b3b30ffd379ac',
  'run-tex.js': 'bb970e6a4e0fd8c41e91c3cf74747e17d8c036dd220bb2c4a6ee9aab403ad535',
})
const TIKZ_RESOURCE_INVENTORY_SHA256 =
  'ad68272777c1e71ced8513d84ee6df20fe00b4116cdfed9a35a43889ce89b7c8'
function replaceOnce(source, before, after) {
  const at = source.indexOf(before)
  if (at < 0 || source.indexOf(before, at + before.length) >= 0)
    throw new Error('TikZ beta24 publication patch does not match source')
  return source.slice(0, at) + after + source.slice(at + before.length)
}
function patchTikzEntry(source) {
  const start = source.indexOf('U=function(e,t,{blocked:')
  const end = source.indexOf(',Q=async e=>', start)
  if (start < 0 || end < 0) throw new Error('TikZ beta24 cache initializer missing')
  const open = source.slice(start + 2, end)
  // Opening an optional cache is deferred until a cache-enabled element actually reads/writes it.
  source =
    source.slice(0, start) +
    `U=(()=>{let cache;return()=>cache||(cache=Promise.resolve().then(()=>${open}).catch(error=>{console.warn('TikZ optional cache unavailable',error);return null}))})()` +
    source.slice(end)
  source = replaceOnce(source, '(await U).get("svgImages",e)', '(await U())?.get("svgImages",e)')
  source = replaceOnce(
    source,
    '(await U).put("svgImages",t,e)',
    '(await U())?.put("svgImages",t,e)'
  )
  source = replaceOnce(
    source,
    `catch(e){return console.log(e),void(r.outerHTML='<img src="//invalid.site/img-not-found.png">')}`,
    `catch(e){r.textContent='TikZ compilation failed: '+e.message;r.dispatchEvent(new CustomEvent('tikzjax-error',{bubbles:true,detail:{message:e.message}}));throw e}`
  )
  return replaceOnce(
    source,
    'try{await r.load(e)}catch(e){console.log(e)}return r',
    'await r.load(e);return r'
  )
}
function patchTikzWorker(source) {
  // TeX reports missing inputs through its existing filesystem path, never a URL fetch escape.
  source = replaceOnce(
    source,
    'fetch(A)',
    `Promise.reject(new Error('TikZ input is not packaged: '+A))`
  )
  // Webpack's global discovery does not need dynamic JavaScript evaluation in browsers.
  return replaceOnce(
    source,
    'function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(A){if("object"==typeof window)return window}}()',
    'globalThis'
  )
}
module.exports = {
  TIKZ_RUNTIME_VERSION,
  TIKZ_RUNTIME_REVISION,
  TIKZ_UPSTREAM_HASHES,
  TIKZ_PUBLISHED_HASHES,
  TIKZ_RESOURCE_INVENTORY_SHA256,
  patchTikzEntry,
  patchTikzWorker,
}
