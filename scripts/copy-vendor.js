const fs = require('fs')
const path = require('path')

const serverDir = path.join(__dirname, '..', 'server')
const vendorDir = path.join(serverDir, 'vendor')

function getPkgDir(pkgPath) {
  const serverPath = path.join(serverDir, 'node_modules', pkgPath)
  if (fs.existsSync(serverPath)) return serverPath
  const clientPath = path.join(__dirname, '..', 'client', 'node_modules', pkgPath)
  if (fs.existsSync(clientPath)) return clientPath
  const rootPath = path.join(__dirname, '..', 'node_modules', pkgPath)
  if (fs.existsSync(rootPath)) return rootPath
  return null
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const copyItems = [
  { srcPkg: 'reveal.js/dist', dest: path.join(vendorDir, 'reveal.js/dist') },
  { srcPkg: 'reveal.js/plugin', dest: path.join(vendorDir, 'reveal.js/plugin') },
  { srcPkg: 'katex/dist', dest: path.join(vendorDir, 'katex/dist') },
  { srcPkg: 'chart.js/dist', dest: path.join(vendorDir, 'chart.js/dist') },
  { srcPkg: 'highlight.js/styles', dest: path.join(vendorDir, 'highlight.js/styles') },
  { srcPkg: 'highlight.js/lib', dest: path.join(vendorDir, 'highlight.js/lib') },
  { srcPkg: 'd3/dist', dest: path.join(vendorDir, 'd3/dist') },
  { srcPkg: 'socket.io-client/dist', dest: path.join(vendorDir, 'socket.io') },
  { srcPkg: '@drgrice1/tikzjax/dist', dest: path.join(vendorDir, 'tikzjax') },
  { srcPkg: '@fortawesome/fontawesome-free/css', dest: path.join(vendorDir, 'font-awesome/css') },
  {
    srcPkg: '@fortawesome/fontawesome-free/webfonts',
    dest: path.join(vendorDir, 'font-awesome/webfonts'),
  },
  { srcPkg: 'qrcode/build', dest: path.join(vendorDir, 'qrcode') },
]

// Remove existing vendor dir
if (fs.existsSync(vendorDir)) {
  fs.rmSync(vendorDir, { recursive: true })
  console.log('Cleaned existing vendor/')
}

for (const { srcPkg, dest } of copyItems) {
  const src = getPkgDir(srcPkg)
  if (!src) {
    console.warn(`WARN: Source not found for package path: ${srcPkg}`)
    continue
  }
  copyDir(src, dest)
  console.log(`✓ Copied: ${path.relative(process.cwd(), dest)}`)
}

// marked: copy single file
const markedSrc = getPkgDir('marked/lib/marked.umd.js')
const markedDest = path.join(vendorDir, 'marked/marked.min.js')
fs.mkdirSync(path.dirname(markedDest), { recursive: true })
if (markedSrc) {
  fs.copyFileSync(markedSrc, markedDest)
  console.log(`✓ Copied: server\\vendor\\marked\\marked.min.js`)
} else {
  console.warn('WARN: marked.min.js not found, check package structure')
}

// --- Download Remote Plugins ---
async function downloadRemotePlugins() {
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

  const remoteFiles = [
    {
      url: 'https://cdn.jsdelivr.net/npm/reveal.js-menu@2.1.0/menu.js',
      dest: path.join(vendorDir, 'reveal-plugins/menu/menu.js'),
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/reveal.js-menu@2.1.0/menu.css',
      dest: path.join(vendorDir, 'reveal-plugins/menu/menu.css'),
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/chalkboard/plugin.js',
      dest: path.join(vendorDir, 'reveal-plugins/chalkboard/plugin.js'),
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/customcontrols/plugin.js',
      dest: path.join(vendorDir, 'reveal-plugins/customcontrols/plugin.js'),
    },
    {
      url: 'https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/customcontrols/style.css',
      dest: path.join(vendorDir, 'reveal-plugins/customcontrols/style.css'),
    },
    // Chalkboard image assets (cursors, eraser, board backgrounds)
    ...chalkboardImages.map((img) => ({
      url: `https://cdn.jsdelivr.net/npm/reveal.js-plugins@4.6.0/chalkboard/img/${img}`,
      dest: path.join(vendorDir, `reveal-plugins/chalkboard/img/${img}`),
    })),
  ]

  for (const file of remoteFiles) {
    try {
      if (fs.existsSync(file.dest)) continue
      fs.mkdirSync(path.dirname(file.dest), { recursive: true })

      console.log(`Downloading ${path.basename(file.dest)}...`)
      const response = await fetch(file.url)
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${file.url}`)

      const isBinary = /\.(png|jpg|jpeg|gif|woff2?|ttf|eot)$/i.test(file.dest)
      if (isBinary) {
        const buf = Buffer.from(await response.arrayBuffer())
        fs.writeFileSync(file.dest, buf)
      } else {
        fs.writeFileSync(file.dest, await response.text())
      }
      console.log(`✓ Fetched remote plugin: ${path.relative(process.cwd(), file.dest)}`)
    } catch (err) {
      console.error(`✗ Failed to download ${file.url}: ${err.message}`)
    }
  }
  console.log('\n✅ Vendor assets ready.')
}

downloadRemotePlugins()
