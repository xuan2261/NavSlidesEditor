const fs = require('node:fs')
const path = require('node:path')
const { build } = require('esbuild')
const { publishVendorAssets } = require('./vendor-publication')

const rootDir = path.join(__dirname, '..')

function getPackagePath(packagePath) {
  const candidates = [
    path.join(rootDir, 'server', 'node_modules', packagePath),
    path.join(rootDir, 'client', 'node_modules', packagePath),
    path.join(rootDir, 'node_modules', packagePath),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

const localSpecs = [
  ['reveal.js/dist', 'reveal.js/dist'],
  ['reveal.js/plugin', 'reveal.js/plugin'],
  ['katex/dist', 'katex/dist'],
  ['chart.js/dist', 'chart.js/dist'],
  ['highlight.js/styles', 'highlight.js/styles'],
  ['highlight.js/lib', 'highlight.js/lib'],
  ['d3/dist', 'd3/dist'],
  ['socket.io-client/dist', 'socket.io'],
  ['@drgrice1/tikzjax/dist', 'tikzjax'],
  ['@fortawesome/fontawesome-free/css', 'font-awesome/css'],
  ['@fortawesome/fontawesome-free/webfonts', 'font-awesome/webfonts'],
  ['marked/lib/marked.umd.js', 'marked/marked.min.js'],
]

const chalkboardImages = [
  'blackboard.png',
  'whiteboard.png',
  'sponge.png',
  'boardmarker-black.png',
  'boardmarker-blue.png',
  'boardmarker-green.png',
  'boardmarker-orange.png',
  'boardmarker-purple.png',
  'boardmarker-red.png',
  'boardmarker-yellow.png',
  'chalk-white.png',
  'chalk-blue.png',
  'chalk-red.png',
  'chalk-green.png',
  'chalk-orange.png',
  'chalk-purple.png',
  'chalk-yellow.png',
]

const remoteItems = [
  ['https://cdn.jsdelivr.net/npm/reveal.js-menu@2.1.0/menu.js', 'reveal-plugins/menu/menu.js'],
  ['https://cdn.jsdelivr.net/npm/reveal.js-menu@2.1.0/menu.css', 'reveal-plugins/menu/menu.css'],
  [
    'https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/chalkboard/plugin.js',
    'reveal-plugins/chalkboard/plugin.js',
  ],
  [
    'https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/customcontrols/plugin.js',
    'reveal-plugins/customcontrols/plugin.js',
  ],
  [
    'https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/customcontrols/style.css',
    'reveal-plugins/customcontrols/style.css',
  ],
  ['https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.min.js', 'mermaid/mermaid.min.js'],
  ...chalkboardImages.map((image) => [
    `https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/chalkboard/img/${image}`,
    `reveal-plugins/chalkboard/img/${image}`,
  ]),
].map(([url, destination]) => ({ url, destination }))

async function buildQrCodeBundle(output) {
  await build({
    entryPoints: [getPackagePath('qrcode/lib/browser.js')],
    outfile: output,
    bundle: true,
    format: 'iife',
    globalName: 'QRCode',
    legalComments: 'none',
    minify: true,
    platform: 'browser',
    target: 'es2018',
  })
}

async function main() {
  const generatedDir = path.join(rootDir, '.tmp', `vendor-generated-${process.pid}`)
  const qrCodeBundle = path.join(generatedDir, 'qrcode.min.js')
  fs.rmSync(generatedDir, { force: true, recursive: true })
  fs.mkdirSync(generatedDir, { recursive: true })

  try {
    await buildQrCodeBundle(qrCodeBundle)
    const localItems = localSpecs.map(([sourceLabel, destination]) => ({
      source: getPackagePath(sourceLabel),
      sourceLabel,
      destination,
    }))
    localItems.push({
      source: qrCodeBundle,
      sourceLabel: 'generated qrcode browser bundle',
      destination: 'qrcode/qrcode.min.js',
    })

    const manifest = await publishVendorAssets({ rootDir, localItems, remoteItems })
    console.log(`Vendor assets ready: ${manifest.files.length} files`)
  } finally {
    fs.rmSync(generatedDir, { force: true, recursive: true })
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
