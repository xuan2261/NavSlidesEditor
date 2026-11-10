const { P_URIS } = require('./ooxml-text-run-xml')

function readContextTheme(p, hosts) {
  const elements = p.one(p.root, 'themeElements')
  if (!elements) p.fail(p.root, 'missing theme elements')
  const colors = {},
    fonts = {},
    declarations = []
  const scheme = p.one(elements, 'clrScheme'),
    fontScheme = p.one(elements, 'fontScheme')
  if (scheme) {
    p.attrs(scheme, ['name'])
    p.children(scheme, [
      'dk1',
      'lt1',
      'dk2',
      'lt2',
      'accent1',
      'accent2',
      'accent3',
      'accent4',
      'accent5',
      'accent6',
      'hlink',
      'folHlink',
    ])
    for (const n of scheme.children) {
      p.attrs(n)
      p.children(n, ['srgbClr', 'sysClr'])
      if (n.children.length !== 1) p.fail(n, 'theme color cardinality')
      const color = n.children[0]
      p.children(color)
      const a = p.attrs(color, color.local === 'sysClr' ? ['val', 'lastClr'] : ['val'])
      const value = color.local === 'sysClr' ? a.lastClr : a.val
      if (!/^[\da-fA-F]{6}$/.test(value || '')) p.fail(color, 'unrepresented theme color')
      colors[n.local] = value
      p.receipt(color)
    }
  }
  if (fontScheme) {
    p.attrs(fontScheme, ['name'])
    p.children(fontScheme, ['majorFont', 'minorFont'])
    for (const n of fontScheme.children) {
      p.attrs(n)
      p.children(n, ['latin', 'ea', 'cs', 'font'], ['font'])
      const result = {},
        scripts = {}
      for (const font of n.children) {
        p.children(font)
        const a = p.attrs(
          font,
          font.local === 'font'
            ? ['script', 'typeface']
            : ['typeface', 'panose', 'pitchFamily', 'charset']
        )
        if (typeof a.typeface !== 'string' || a.typeface.startsWith('+'))
          p.fail(font, 'unrepresented theme font')
        if (font.local === 'font') {
          if (
            !/^[A-Z][a-z]{3}$/.test(a.script || '') ||
            !a.typeface ||
            Object.hasOwn(scripts, a.script)
          )
            p.fail(font, 'ambiguous theme script font')
          scripts[a.script] = a.typeface
        } else
          result[{ latin: 'latin', ea: 'eastAsian', cs: 'complexScript' }[font.local]] = a.typeface
        declarations.push({ id: p.receipt(font), source: p.location(font), ...a })
      }
      if (Object.keys(scripts).length) result.scripts = scripts
      fonts[n.local === 'majorFont' ? 'major' : 'minor'] = result
    }
  }
  let colorMap = {}
  let masterOnly = false
  for (const host of hosts) {
    if (masterOnly && host.root.local !== 'sldMaster') continue
    const override = host.one(host.root, 'clrMapOvr', P_URIS)
    let mapping
    if (override) {
      host.attrs(override)
      host.children(override, ['masterClrMapping', 'overrideClrMapping'])
      if (override.children.length !== 1) host.fail(override, 'color map override cardinality')
      const n = override.children[0]
      if (n.local === 'masterClrMapping') {
        host.attrs(n)
        host.children(n)
        host.receipt(n)
        masterOnly = true
        continue
      }
      mapping = n
    } else mapping = host.one(host.root, 'clrMap', P_URIS)
    if (!mapping) continue
    host.children(mapping)
    colorMap = host.attrs(mapping, [
      'bg1',
      'tx1',
      'bg2',
      'tx2',
      'accent1',
      'accent2',
      'accent3',
      'accent4',
      'accent5',
      'accent6',
      'hlink',
      'folHlink',
    ])
    if (
      Object.values(colorMap).some((v) => !/^(dk[12]|lt[12]|accent[1-6]|hlink|folHlink)$/.test(v))
    )
      host.fail(mapping, 'color map target')
    host.receipt(mapping)
    break
  }
  return {
    theme: { id: p.receipt(p.root), source: p.location(p.root), colors, fonts, colorMap },
    declarations,
  }
}
module.exports = { readContextTheme }
