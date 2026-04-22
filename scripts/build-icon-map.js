#!/usr/bin/env node
/**
 * Build icon data map from lucide-react.
 * Run: node scripts/build-icon-map.js
 */
const React = require('react')
const ReactDOMServer = require('react-dom/server')
const Lucide = require('lucide-react')
const fs = require('fs')
const path = require('path')

const SKIP = new Set([
  'createContext',
  'useCallback',
  'useContext',
  'useEffect',
  'useMemo',
  'useRef',
  'useState',
  'useReducer',
  'createElement',
  'forwardRef',
  'lazy',
  'memo',
  'Suspense',
  'Fragment',
])

const rawMap = {}

Object.keys(Lucide).forEach((name) => {
  if (!/^[A-Z]/.test(name)) return
  if (SKIP.has(name)) return
  const Comp = Lucide[name]
  if (!Comp) return
  const renderFn = Comp.render || (typeof Comp === 'function' ? Comp : null)
  if (!renderFn) return

  try {
    const el = React.createElement(renderFn, { size: 24 })
    const html = ReactDOMServer.renderToStaticMarkup(el)
    const inner = html.replace(/^<svg[^>]*>/i, '').replace(/<\/svg>$/i, '')
    rawMap[name] = inner
  } catch {
    // skip
  }
})

// Dedupe: prefer short name over Icon-suffixed variant
const map = {}
Object.keys(rawMap)
  .sort()
  .forEach((name) => {
    const base = name.replace(/Icon$/, '')
    // Only write if this name is shorter (preferred) or base doesn't exist
    if (!map[base]) {
      map[base] = rawMap[base] || rawMap[name]
    }
    if (!map[name] && !name.endsWith('Icon')) {
      map[name] = rawMap[name]
    }
  })

const outPath = path.join(__dirname, '..', 'shared', 'data', 'icon-paths.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(map, null, 2))
console.log(`Wrote ${Object.keys(map).length} icons to ${outPath}`)
