import { describe, expect, it } from 'vitest'
import { parseHtmlTree, mergeInlineStyle } from 'revealjs-shared'
import { correctNativeHtml } from './ooxml-native-text-style-html.js'
import { decodeXml } from './ooxml-text-run-xml.js'

const style = (node) => Object.fromEntries(String(node.attrs?.style || '').split(';').filter((entry) => entry.trim())
  .map((entry) => { const colon = entry.indexOf(':'); return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()] }))
const decode = (text) => decodeXml(text.replaceAll('&nbsp;', '&#160;'))
function nodes(content) {
  const result = []
  function walk(node, inherited = {}) {
    const resolved = mergeInlineStyle(inherited, node)
    result.push({ node, resolved })
    for (const child of node.children || []) walk(child, resolved)
  }
  walk(parseHtmlTree(content))
  return result
}
const text = (content) => nodes(content).filter(({ node }) => node.type === 'text').map(({ node }) => decode(node.text)).join('')
const nodeText = (node) => node.type === 'text' ? decode(node.text) : (node.children || []).map(nodeText).join('')
const paragraph = (runs, extra = {}) => ({ runs, style: { 'white-space': 'pre-wrap', 'tab-size': '72px', ...extra } })
const run = (value, extra = {}) => ({ text: value, style: extra })

describe('source-faithful native rich text whitespace', () => {
  it('restores authored spaces, NBSP and tabs while retaining mixed links and parser emphasis', () => {
    const input = '<p><b>&nbsp;A&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</b><a href="https://example.test">link&nbsp;</a><i>&nbsp;text&nbsp;</i></p>'
    const source = [run(' A \t', { 'font-family': 'Arial' }), run('link\u00a0', { color: '#AA0000' }), run(' text ')]
    const result = correctNativeHtml(input, [paragraph(source)])
    expect(text(result)).toBe(' A \tlink\u00a0 text ')
    const entries = nodes(result)
    const link = entries.find(({ node }) => node.tag === 'a').node
    expect(link.attrs.href).toBe('https://example.test')
    expect(nodeText(link)).toBe('link\u00a0')
    expect(entries.filter(({ node }) => node.type === 'text' && decode(node.text).includes('A'))[0].resolved)
      .toMatchObject({ bold: true, fontFace: 'Arial' })
    expect(entries.some(({ node, resolved }) => node.type === 'text' && decode(node.text).includes('text') && resolved.italic)).toBe(true)
  })

  it('restores a tab expanded across parser text leaves without reconstructing rich containers', () => {
    const result = correctNativeHtml('<p><b>&nbsp;&nbsp;</b><i>&nbsp;&nbsp;</i><a href="#target">End</a></p>',
      [paragraph([run('\tEnd')])])
    expect(text(result)).toBe('\tEnd')
    expect(nodes(result).filter(({ node }) => ['b', 'i', 'a'].includes(node.tag)).map(({ node }) => node.tag)).toEqual(['b', 'i', 'a'])
  })

  it('does not turn four authored spaces into a tab when parser coverage contains a literal tab', () => {
    const result = correctNativeHtml('<p>\tWord</p>', [paragraph([run('  ', { color: '#AA0000' }), run('  Word')])])
    expect(text(result)).toBe('    Word')
    expect(nodes(result).filter(({ node, resolved }) => node.type === 'text' && resolved.color === '#AA0000')
      .map(({ node }) => decode(node.text)).join('')).toBe('  ')
  })

  it('retains cached fields and line breaks when their source text and break positions match', () => {
    const input = '<ul><li><a href="#target">First&nbsp;</a><br><span data-field="datetime1">2020-02-03</span></li></ul>'
    const runs = [run('First '), { kind: 'break', text: '', style: {} }, run('2020-02-03')]
    const result = correctNativeHtml(input, [paragraph(runs)])
    expect(text(result)).toBe('First 2020-02-03')
    expect(nodes(result).filter(({ node }) => node.tag === 'br')).toHaveLength(1)
    expect(nodes(result).find(({ node }) => node.attrs?.['data-field']).node.attrs['data-field']).toBe('datetime1')
    expect(nodes(result).some(({ node }) => node.tag === 'li')).toBe(true)
  })

  it.each([
    '<p>A<br>B</p>',
    '<p><span data-field="datetime1">Other</span></p>',
    '<p><math>AB</math></p>',
  ])('leaves unsupported or nonexact source coverage unchanged for %s', (input) => {
    expect(correctNativeHtml(input, [paragraph([run('AB')])])).toBe(input)
  })

  it('marks literal source tabs for measured explicit stops without replacing linked text', () => {
    const input = '<p><a href="#target">A&nbsp;&nbsp;&nbsp;&nbsp;B</a></p>'
    const result = correctNativeHtml(input, [paragraph([run('A\tB')], { '--pptx-tab-stops': '72:r' })])
    expect(text(result)).toBe('A\tB')
    const entries = nodes(result)
    const tab = entries.find(({ node }) => style(node)['--pptx-tab'] === '1').node
    expect(decode(tab.children[0].text)).toBe('\t')
    const linked = entries.find(({ node }) => node.tag === 'a').node
    expect(linked.attrs.href).toBe('#target')
    expect(linked.children).toContain(tab)
  })
})
