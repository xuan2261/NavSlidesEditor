const { SUPPORTED_REVEAL_THEMES } = require('./theme-presets.js')

const REVEAL_RUNTIME_VERSION = '6.0.2'
const REVEAL_VENDOR_DIST_URL = '/vendor/reveal.js/dist'

const REVEAL_ASSET_PATHS = Object.freeze({
  resetCss: `${REVEAL_VENDOR_DIST_URL}/reset.css`,
  revealCss: `${REVEAL_VENDOR_DIST_URL}/reveal.css`,
  revealJs: `${REVEAL_VENDOR_DIST_URL}/reveal.js`,
  notesJs: `${REVEAL_VENDOR_DIST_URL}/plugin/notes.js`,
  highlightJs: `${REVEAL_VENDOR_DIST_URL}/plugin/highlight.js`,
  markdownJs: `${REVEAL_VENDOR_DIST_URL}/plugin/markdown.js`,
  mathJs: `${REVEAL_VENDOR_DIST_URL}/plugin/math.js`,
  searchJs: `${REVEAL_VENDOR_DIST_URL}/plugin/search.js`,
  zoomJs: `${REVEAL_VENDOR_DIST_URL}/plugin/zoom.js`,
  highlightMonokaiCss: `${REVEAL_VENDOR_DIST_URL}/plugin/highlight/monokai.css`,
  highlightZenburnCss: `${REVEAL_VENDOR_DIST_URL}/plugin/highlight/zenburn.css`,
})

const REVEAL_THEME_NAMES = SUPPORTED_REVEAL_THEMES

const REVEAL_THEME_PATHS = Object.freeze(
  Object.fromEntries(
    REVEAL_THEME_NAMES.map((theme) => [theme, `${REVEAL_VENDOR_DIST_URL}/theme/${theme}.css`])
  )
)

const REVEAL_REQUIRED_VENDOR_PATHS = Object.freeze(
  [...Object.values(REVEAL_ASSET_PATHS), ...Object.values(REVEAL_THEME_PATHS)].map((assetPath) =>
    assetPath.slice('/vendor/'.length)
  )
)

const REVEAL_REQUIRED_OFFLINE_ASSET_PATHS = Object.freeze([
  ...Object.values(REVEAL_ASSET_PATHS),
  ...Object.values(REVEAL_THEME_PATHS),
])

const REVEAL_VENDOR_COPY_SPEC = Object.freeze({
  sourceLabel: 'reveal.js/dist',
  destination: 'reveal.js/dist',
})

function revealThemePath(theme) {
  return REVEAL_THEME_PATHS[theme] || REVEAL_THEME_PATHS.black
}

module.exports = {
  REVEAL_ASSET_PATHS,
  REVEAL_REQUIRED_OFFLINE_ASSET_PATHS,
  REVEAL_REQUIRED_VENDOR_PATHS,
  REVEAL_RUNTIME_VERSION,
  REVEAL_THEME_NAMES,
  REVEAL_THEME_PATHS,
  REVEAL_VENDOR_COPY_SPEC,
  REVEAL_VENDOR_DIST_URL,
  revealThemePath,
}
