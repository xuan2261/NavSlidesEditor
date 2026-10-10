const { createPluginMessageRuntime } = require('./plugin-message-contract.js')
const { escapeInlineScript } = require('./config-serialization.js')
const HTML_SANDBOX = 'allow-scripts'
const HTML_RESOURCE_KINDS = Object.freeze([
  'script',
  'style',
  'image',
  'media',
  'font',
  'frame',
  'connect',
])
const own = (object, keys) => {
  if (!object || Object.getPrototypeOf(object) !== Object.prototype) return false
  return Reflect.ownKeys(object).every(
    (key) =>
      typeof key === 'string' &&
      keys.includes(key) &&
      Object.getOwnPropertyDescriptor(object, key)?.get === undefined &&
      Object.getOwnPropertyDescriptor(object, key)?.set === undefined
  )
}
function resources(value, name) {
  if (
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > 256 ||
    Reflect.ownKeys(value).length !== value.length + 1 ||
    Reflect.ownKeys(value).some((key) => {
      if (key === 'length') return false
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return (
        typeof key !== 'string' ||
        !/^(0|[1-9]\d*)$/.test(key) ||
        Number(key) >= value.length ||
        !descriptor ||
        !('value' in descriptor)
      )
    })
  )
    throw new TypeError(`${name} must be a plain dense array of at most 256 resources.`)
  return value.map((resource) => {
    if (
      !own(resource, ['url', 'kind']) ||
      !HTML_RESOURCE_KINDS.includes(resource.kind) ||
      typeof resource.url !== 'string' ||
      !resource.url ||
      resource.url.length > 4096 ||
      /[\s<>"'`\\]/.test(resource.url)
    ) {
      throw new TypeError(
        `${name} entries need a supported kind and a valid URL (maximum 4096 characters).`
      )
    }
    let parsed
    try {
      parsed = new URL(resource.url, 'https://declaration.invalid/')
    } catch {
      throw new TypeError(`Invalid resource URL: ${resource.url}`)
    }
    if (
      !['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      throw new TypeError(
        `Unsupported resource URL: ${resource.url}. Upload the asset or use an HTTP(S) URL without credentials.`
      )
    }
    return { url: resource.url, kind: resource.kind }
  })
}
function validateHtmlDependencies(value) {
  if (value === undefined) return undefined
  if (
    !own(value, ['network', 'offlineCapable', 'resources', 'dynamicResources']) ||
    typeof value.network !== 'boolean' ||
    typeof value.offlineCapable !== 'boolean'
  ) {
    throw new TypeError(
      'HTML dependencies require network/offlineCapable booleans and static/dynamic resource arrays; unknown fields are not allowed.'
    )
  }
  return {
    network: value.network,
    offlineCapable: value.offlineCapable,
    resources: resources(value.resources, 'resources'),
    dynamicResources: resources(value.dynamicResources, 'dynamicResources'),
  }
}
function buildSandboxCsp(dependencies, { baseUrl, portable = false } = {}) {
  const metadata = validateHtmlDependencies(dependencies)
  const origins = Object.fromEntries(HTML_RESOURCE_KINDS.map((kind) => [kind, new Set()]))
  if (metadata?.network && !portable) {
    for (const resource of [...metadata.resources, ...metadata.dynamicResources]) {
      if (/^(data|blob):/i.test(resource.url)) continue
      let url
      try {
        url = baseUrl ? new URL(resource.url, baseUrl) : new URL(resource.url)
      } catch {
        throw new TypeError(
          `Hosted relative dependency ${resource.url} needs an absolute HTTP(S) base URL.`
        )
      }
      if (!['http:', 'https:'].includes(url.protocol))
        throw new TypeError('Hosted dependencies need an HTTP(S) base URL.')
      origins[resource.kind].add(url.origin)
    }
  }
  const directive = (name, kind, local = []) =>
    `${name} ${[...local, ...origins[kind]].join(' ') || "'none'"}`
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    directive('script-src', 'script', ["'unsafe-inline'"]),
    directive('style-src', 'style', ["'unsafe-inline'"]),
    directive('img-src', 'image', ['data:', 'blob:']),
    directive('media-src', 'media', ['data:', 'blob:']),
    directive('font-src', 'font', ['data:', 'blob:']),
    directive('frame-src', 'frame', ['data:', 'blob:']),
    directive('connect-src', 'connect'),
    "worker-src 'none'",
    "manifest-src 'none'",
  ].join('; ')
}
function buildSandboxDocument(content, dependencies, options) {
  if (typeof content !== 'string') throw new TypeError('HTML source must be a string.')
  const csp = buildSandboxCsp(dependencies, options).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  // Prepend before even malformed author documents: no source script can precede the policy.
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">${content}`
}
function buildSandboxFrameDocument(content, dependencies, { plugin = false, ...options } = {}) {
  const metadata = validateHtmlDependencies(dependencies)
  const child = buildSandboxDocument(content, metadata, options)
  if (metadata?.network && !options.portable) return child
  const attribute = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  const declaration = metadata
    ? ` data-html-dependencies="${attribute(JSON.stringify(metadata))}"`
    : ''
  const frame = `<iframe id="ns-sandbox-child" sandbox="${HTML_SANDBOX}" referrerpolicy="no-referrer"${declaration}`
  let body
  if (plugin) {
    const script = `const frame=document.getElementById('ns-sandbox-child');const relay=(${createPluginMessageRuntime.toString()})().createPluginRelayBridge({frame,relayWindow:window});window.addEventListener('pagehide',()=>relay.destroy(),{once:true});frame.srcdoc=frame.getAttribute('data-ns-srcdoc');`
    body = `${frame} data-ns-srcdoc="${attribute(child)}"></iframe><script>${escapeInlineScript(script)}</script>`
  } else body = `${frame} srcdoc="${attribute(child)}"></iframe>`
  const layout =
    '<style>html,body,iframe{width:100%;height:100%;margin:0;border:0;display:block;overflow:hidden;background:transparent}</style>'
  // No authored content is parsed in this container. Its frame policy constrains child self-navigation.
  return buildSandboxDocument(
    `<html data-ns-sandbox-container><head>${layout}</head><body>${body}</body></html>`,
    undefined,
    { portable: true }
  )
}
module.exports = {
  HTML_SANDBOX,
  HTML_RESOURCE_KINDS,
  validateHtmlDependencies,
  buildSandboxCsp,
  buildSandboxDocument,
  buildSandboxFrameDocument,
}
