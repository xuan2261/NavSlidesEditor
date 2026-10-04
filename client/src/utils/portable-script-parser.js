import { parse } from 'acorn'
export function walkJavaScript(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'string') visit(node, parent)
  for (const [key, value] of Object.entries(node)) {
    if (['start', 'end', 'loc'].includes(key)) continue
    if (Array.isArray(value)) value.forEach((child) => walkJavaScript(child, visit, node))
    else if (value && typeof value === 'object') walkJavaScript(value, visit, node)
  }
}
export function parseJavaScript(source, module, graph, base, context) {
  try {
    return parse(source, {
      ecmaVersion: 'latest',
      sourceType: module ? 'module' : 'script',
      allowHashBang: true,
    })
  } catch (error) {
    throw graph.error('parse', base, context, error.message)
  }
}
function name(node) {
  if (node?.type === 'Identifier') return node.name
  if (node?.type === 'MemberExpression')
    return node.computed ? node.property.value : node.property.name
  return ''
}
export function finiteUrlToken(token) {
  if (token?.type === 'Literal' && typeof token.value === 'string')
    return { url: token.value, wrapped: false }
  if (
    token?.type === 'NewExpression' &&
    name(token.callee) === 'URL' &&
    token.arguments[0]?.type === 'Literal' &&
    typeof token.arguments[0].value === 'string' &&
    token.arguments[1]?.type === 'MemberExpression' &&
    token.arguments[1].object?.type === 'MetaProperty' &&
    token.arguments[1].object.meta.name === 'import' &&
    name(token.arguments[1]) === 'url'
  ) {
    return { url: token.arguments[0].value, wrapped: true }
  }
  return null
}
const safeGet = (options) =>
  !options ||
  (options.type === 'ObjectExpression' &&
    options.properties.every(
      (property) =>
        property.type === 'Property' &&
        !property.computed &&
        !property.method &&
        (property.key.name || property.key.value) === 'method' &&
        property.value.type === 'Literal' &&
        property.value.value === 'GET'
    ))
const capabilities = new Set([
  'fetch',
  'Worker',
  'SharedWorker',
  'WebSocket',
  'EventSource',
  'RTCPeerConnection',
  'XMLHttpRequest',
  'sendBeacon',
  'importScripts',
  'eval',
  'Function',
])
const browserScopes = new Set(['window', 'self', 'globalThis', 'navigator'])
function escapedCapability(node, parent) {
  if (
    node.type === 'VariableDeclarator' &&
    node.init?.type === 'Identifier' &&
    browserScopes.has(node.init.name)
  )
    return true
  if (node.type === 'MemberExpression') {
    if (node.computed && node.object.type === 'Identifier' && browserScopes.has(node.object.name))
      return true
    if (!capabilities.has(name(node))) return false
    return (
      node.computed ||
      !['CallExpression', 'NewExpression'].includes(parent?.type) ||
      parent.callee !== node ||
      node.object.type !== 'Identifier' ||
      !browserScopes.has(node.object.name)
    )
  }
  if (
    node.type === 'Property' &&
    parent?.type === 'ObjectPattern' &&
    capabilities.has(name(node.key))
  )
    return true
  if (node.type !== 'Identifier' || !capabilities.has(node.name)) return false
  if (
    (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
    (parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) ||
    (parent?.type === 'VariableDeclarator' && parent.id === node)
  )
    return false
  return !['CallExpression', 'NewExpression'].includes(parent?.type) || parent.callee !== node
}
export function finiteJavaScriptReferences(ast) {
  const references = [],
    consumed = new Set()
  walkJavaScript(ast, (node, parent) => {
    if (escapedCapability(node, parent))
      references.push({ token: node, forbidden: true, kind: 'script' })
  })
  const add = (reference) => {
    references.push(reference)
    if (reference.token?.type === 'NewExpression') consumed.add(reference.token)
  }
  walkJavaScript(ast, (node) => {
    if (consumed.has(node)) return
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source
    ) {
      add({ token: node.source, kind: 'script', module: true, dynamic: false })
    } else if (node.type === 'ImportExpression')
      add({ token: node.source, kind: 'script', module: true, dynamic: true })
    else if (['CallExpression', 'NewExpression'].includes(node.type)) {
      const callee = name(node.callee)
      if (['WebSocket', 'EventSource', 'RTCPeerConnection', 'sendBeacon'].includes(callee))
        add({ token: node.arguments[0], kind: 'connect', forbidden: true })
      if (callee === 'fetch')
        add({
          token: node.arguments[0],
          call: node,
          kind: 'connect',
          dynamic: true,
          forbidden: !safeGet(node.arguments[1]),
        })
      if (['Worker', 'SharedWorker'].includes(callee))
        add({
          token: node.arguments[0],
          kind: 'script',
          worker: true,
          dynamic: true,
          module:
            node.arguments[1]?.type === 'ObjectExpression' &&
            node.arguments[1].properties.some(
              (property) =>
                (property.key.name || property.key.value) === 'type' &&
                property.value.value === 'module'
            ),
        })
      if (callee === 'URL' && finiteUrlToken(node))
        add({
          token: node,
          kind: /\.m?js(?:[?#]|$)/i.test(node.arguments[0].value)
            ? 'script'
            : /\.(?:json|txt|csv)(?:[?#]|$)/i.test(node.arguments[0].value)
              ? 'connect'
              : 'image',
          dynamic: false,
        })
      if (callee === 'importScripts')
        node.arguments.forEach((token) => add({ token, kind: 'script', dynamic: true }))
      if (
        callee === 'open' &&
        node.arguments.length > 1 &&
        /^(?:GET|POST|PUT|DELETE|HEAD)$/i.test(node.arguments[0]?.value || '')
      )
        add({ token: node.arguments[1], kind: 'connect', dynamic: true, forbidden: true })
      if (callee === 'setAttribute' && ['src', 'href', 'poster'].includes(node.arguments[0]?.value))
        add({
          token: node.arguments[1],
          kind: /\.m?js(?:[?#]|$)/i.test(finiteUrlToken(node.arguments[1])?.url || '')
            ? 'script'
            : 'image',
          dynamic: true,
        })
      if (callee === 'eval' || (node.type === 'NewExpression' && callee === 'Function'))
        add({ token: node.arguments[0], forbidden: true, kind: 'script' })
    } else if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression') {
      const property = name(node.left),
        value = finiteUrlToken(node.right)?.url
      if (['src', 'href', 'poster', 'srcset'].includes(property) && !value?.startsWith('#')) {
        add({
          token: node.right,
          kind:
            property === 'href' && /\.css(?:[?#]|$)/i.test(value || '')
              ? 'style'
              : /\.m?js(?:[?#]|$)/i.test(value || '')
                ? 'script'
                : 'image',
          dynamic: true,
        })
      }
    }
  })
  return references
}
export function replaceSourceRanges(source, replacements) {
  let output = source
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end)
  return output
}
