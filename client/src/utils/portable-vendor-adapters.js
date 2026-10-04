import { REVEAL_REQUIRED_OFFLINE_ASSET_PATHS } from 'revealjs-shared'
import { parseJavaScript, walkJavaScript, replaceSourceRanges } from './portable-script-parser.js'
import { rewriteCss } from './portable-css-rewriter.js'
import { safeStyleText } from 'revealjs-shared/src/rich-text-style-sanitizer.js'
import { rewriteTikzScript } from './portable-tikz-adapter.js'
const EXTRA = [
  '/vendor/d3/dist/d3.min.js',
  '/vendor/chart.js/dist/chart.umd.js',
  '/vendor/qrcode/qrcode.min.js',
  '/vendor/marked/marked.min.js',
  '/vendor/katex/dist/katex.min.js',
  '/vendor/mermaid/mermaid.min.js',
  '/vendor/reveal-plugins/menu/menu.js',
  '/vendor/reveal-plugins/chalkboard/plugin.js',
  '/vendor/reveal-plugins/customcontrols/plugin.js',
  '/vendor/tikzjax/tikzjax.js',
]
export function isPackagedScript(url, graph) {
  const parsed = new URL(url)
  return (
    parsed.origin === graph.origin &&
    [...REVEAL_REQUIRED_OFFLINE_ASSET_PATHS, ...EXTRA].includes(parsed.pathname)
  )
}
export async function rewritePackagedScript(source, base, state, context) {
  const path = new URL(base).pathname
  if (path === '/vendor/tikzjax/tikzjax.js') return rewriteTikzScript(source, base, state, context)
  if (!/\/reveal-plugins\/(?:chalkboard|menu)\//.test(path)) return source
  const graph = state.graph,
    ast = parseJavaScript(source, false, graph, base, context),
    replacements = []
  if (path.endsWith('/chalkboard/plugin.js')) {
    const expressions = []
    walkJavaScript(ast, (node) => {
      if (
        node.type === 'BinaryExpression' &&
        node.operator === '+' &&
        node.left.type === 'Identifier' &&
        node.left.name === 'path' &&
        node.right.type === 'Literal' &&
        typeof node.right.value === 'string' &&
        node.right.value.startsWith('img/')
      )
        expressions.push(node)
    })
    if (!expressions.length)
      throw graph.error(
        'undeclared',
        base,
        context,
        'Packaged chalkboard asset adapter does not match this version'
      )
    for (const node of expressions) {
      const [asset, ...suffix] = node.right.value.split(')')
      const embedded = await graph.embed(asset, 'image', base, context)
      replacements.push({
        start: node.start,
        end: node.end,
        value: JSON.stringify(embedded + (suffix.length ? `)${suffix.join(')')}` : '')),
      })
    }
  } else {
    const loaders = []
    walkJavaScript(ast, (node) => {
      if (
        node.type === 'CallExpression' &&
        node.arguments[0]?.type === 'BinaryExpression' &&
        node.arguments[0].right?.value === 'menu.css'
      )
        loaders.push(node)
    })
    if (loaders.length !== 1)
      throw graph.error(
        'undeclared',
        base,
        context,
        'Packaged menu stylesheet adapter does not match this version'
      )
    for (const reference of ['menu.css', 'font-awesome/css/all.css']) {
      const node = await graph.load(reference, 'style', base, context)
      const css = await rewriteCss(
        new TextDecoder().decode(node.bytes),
        node.base,
        graph,
        graph.descend(context, node.url)
      )
      const style = state.document.createElement('style')
      style.textContent = safeStyleText(css)
      state.document.head.append(style)
    }
    replacements.push({
      start: loaders[0].start,
      end: loaders[0].end,
      value: '(Reveal.isReady()?M():Reveal.on("ready",M))',
    })
  }
  return replaceSourceRanges(source, replacements)
}
