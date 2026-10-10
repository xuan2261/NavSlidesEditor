import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import { resourceKind } from './portable-resource-bytes.js'
function valueUrl(node) {
  if (node.type === 'string') return node.value
  if (node.type === 'function' && node.value.toLowerCase() === 'url')
    return valueParser
      .stringify(node.nodes)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
  return null
}
export async function rewriteCss(css, base, graph, context = {}) {
  let root
  try {
    root = postcss.parse(css, { from: base })
  } catch (error) {
    throw graph.error('parse', base, context, error.message)
  }
  const imports = []
  root.walkAtRules('import', (rule) => imports.push(rule))
  for (const rule of imports) {
    const params = valueParser(rule.params)
    const first = params.nodes.find((node) => !['space', 'comment'].includes(node.type))
    const reference = first && valueUrl(first)
    if (!reference) throw graph.error('parse', base, context, 'Unsupported CSS import')
    const node = await graph.load(reference, 'style', base, context)
    const next = graph.descend(context, node.url)
    const nested = await rewriteCss(new TextDecoder().decode(node.bytes), node.base, graph, next)
    const imported = postcss.parse(nested)
    let tail = valueParser.stringify(params.nodes.slice(params.nodes.indexOf(first) + 1)).trim()
    const layer = /^layer(?:\(([^)]*)\))?(?:\s+|$)/i.exec(tail)
    if (layer) {
      const wrapper = postcss.atRule({ name: 'layer', params: layer[1] || '' })
      wrapper.append(imported.nodes)
      imported.append(wrapper)
      tail = tail.slice(layer[0].length).trim()
    }
    const supports = /^supports\(/i.test(tail) ? valueParser(tail).nodes[0] : null
    if (supports) {
      const wrapper = postcss.atRule({
        name: 'supports',
        params: `(${valueParser.stringify(supports.nodes)})`,
      })
      wrapper.append(imported.nodes)
      imported.append(wrapper)
      tail = tail.slice(valueParser.stringify(supports).length).trim()
    }
    if (tail) {
      const media = postcss.atRule({ name: 'media', params: tail })
      media.append(imported.nodes)
      rule.replaceWith(media)
    } else rule.replaceWith(...imported.nodes)
  }
  const declarations = []
  root.walkDecls((decl) => declarations.push(decl))
  for (const decl of declarations) {
    const parsed = valueParser(decl.value),
      urls = []
    parsed.walk((node) => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        urls.push(node)
        return false
      }
      if (node.type === 'function' && /^(?:-webkit-)?image-set$/i.test(node.value)) {
        for (const child of node.nodes) if (child.type === 'string') urls.push(child)
      }
    })
    for (const token of urls) {
      const reference = valueUrl(token)
      if (!reference || reference.startsWith('#')) continue
      const embedded = await graph.embed(reference, resourceKind(reference), base, context)
      if (token.type === 'string') {
        token.value = embedded
        token.quote = '"'
      } else token.nodes = [{ type: 'string', quote: '"', value: embedded }]
    }
    decl.value = parsed.toString()
  }
  return root.toString()
}
export async function rewriteStyleAttribute(css, base, graph, context) {
  const wrapped = await rewriteCss(`portable{${css}}`, base, graph, context)
  return wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}'))
}
