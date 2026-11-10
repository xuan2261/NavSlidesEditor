const { readFileSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const { createHash } = require('node:crypto')
const vm = require('node:vm')
const { compareParserParts, relationshipPart } = require('./parser-part-names')
const { extractChartData } = require('./pptxtojson-chart-data')

// pptxtojson 2.0.2 compatibility patch: exact registry CJS bytes, independently
// checked against electron/server-package-lock.json's tarball integrity.
// Enumeration, three relationship paths, and chart cache extraction change only
// in memory. Installed bytes and source archives are never rewritten.
const VERSION = '2.0.2'
const SHA256 = 'b3a9a789141c58363ff7723d6408fbb36b749008eb7e79318a3970ef42434cf6'
const SUBSTITUTIONS = [
  [String.raw`function(t,e){return+/(\d+)\.xml/.exec(t)[1]-+/(\d+)\.xml/.exec(e)[1]}`, 'compareParserParts'],
  ['a.replace("slides/slide","slides/_rels/slide")+".rels"', 'relationshipPart(a)'],
  ['p.replace("slideLayouts/slideLayout","slideLayouts/_rels/slideLayout")+".rels"', 'relationshipPart(p)'],
  ['b.replace("slideMasters/slideMaster","slideMasters/_rels/slideMaster")+".rels"', 'relationshipPart(b)'],
]
const CHART_START = 'function mu(t){'
const CHART_END = 'function yu(t,e){'
let loaded

function loadPptxtojson() {
  if (loaded) return loaded
  const entry = require.resolve('pptxtojson/dist/index.cjs')
  const pkg = JSON.parse(readFileSync(resolve(dirname(entry), '../package.json'), 'utf8'))
  if (pkg.version !== VERSION) throw new Error('Unsupported pptxtojson runtime version')
  const bytes = readFileSync(entry)
  if (createHash('sha256').update(bytes).digest('hex') !== SHA256)
    throw new Error('Unsupported pptxtojson runtime digest')
  let source = bytes.toString('utf8')
  for (const [anchor, replacement] of SUBSTITUTIONS) {
    if (source.split(anchor).length !== 2) throw new Error('Invalid pptxtojson runtime patch anchor')
    source = source.replace(anchor, replacement)
  }
  if (source.split(CHART_START).length !== 2 || source.split(CHART_END).length !== 2)
    throw new Error('Invalid pptxtojson chart extraction patch anchors')
  const start = source.indexOf(CHART_START), end = source.indexOf(CHART_END)
  if (end <= start) throw new Error('Invalid pptxtojson chart extraction patch boundary')
  source = source.slice(0, start) + 'function mu(t){return extractChartData(t)}' + source.slice(end)
  const exports = {}
  vm.compileFunction(source, ['exports', 'compareParserParts', 'relationshipPart', 'extractChartData'], {
    filename: entry,
  }).call(exports, exports, compareParserParts, relationshipPart, extractChartData)
  if (typeof exports.parse !== 'function') throw new Error('Invalid pptxtojson runtime parse export')
  loaded = { parse: exports.parse, packageVersion: VERSION }
  return loaded
}

module.exports = { loadPptxtojson }
