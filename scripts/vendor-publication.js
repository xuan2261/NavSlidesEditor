const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

function removePath(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { force: true, recursive: true })
}

function resolveDestination(root, relativePath) {
  const destination = path.resolve(root, relativePath)
  const relative = path.relative(root, destination)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid vendor destination: ${relativePath}`)
  }
  return destination
}

function copySource(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const stat = fs.statSync(source)
  if (stat.isDirectory()) {
    fs.cpSync(source, destination, { recursive: true })
    return
  }
  if (!stat.isFile()) throw new Error(`Unsupported vendor source: ${source}`)
  fs.copyFileSync(source, destination)
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function collectFiles(root, directory = root) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, entryPath))
    } else if (entry.isFile()) {
      const stat = fs.statSync(entryPath)
      files.push({
        path: path.relative(root, entryPath).split(path.sep).join('/'),
        bytes: stat.size,
        sha256: hashFile(entryPath),
      })
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

async function downloadRemote(fetchImpl, item, destination) {
  const response = await fetchImpl(item.url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${item.url}`)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()))
}

async function publishVendorAssets({
  rootDir,
  localItems,
  remoteItems,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  const serverDir = path.join(rootDir, 'server')
  const vendorDir = path.join(serverDir, 'vendor')
  const nonce = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`
  const stageDir = path.join(serverDir, `vendor-stage-${nonce}`)
  const backupDir = path.join(serverDir, `vendor-backup-${nonce}`)

  for (const item of localItems) {
    if (!item.source || !fs.existsSync(item.source)) {
      throw new Error(`Required vendor source not found: ${item.sourceLabel || item.source}`)
    }
  }

  removePath(stageDir)
  removePath(backupDir)
  fs.mkdirSync(stageDir, { recursive: true })

  try {
    for (const item of localItems) {
      const destination = resolveDestination(stageDir, item.destination)
      copySource(item.source, destination)
      logger.log(`Copied vendor asset: ${item.destination}`)
    }

    for (const item of remoteItems) {
      try {
        const destination = resolveDestination(stageDir, item.destination)
        await downloadRemote(fetchImpl, item, destination)
        logger.log(`Fetched vendor asset: ${item.destination}`)
      } catch (error) {
        if (item.required === false) {
          logger.warn(`Optional vendor asset unavailable: ${item.url}: ${error.message}`)
          continue
        }
        throw new Error(`Required vendor asset download failed: ${item.url}: ${error.message}`)
      }
    }

    const manifest = { schemaVersion: 1, files: collectFiles(stageDir) }
    fs.writeFileSync(
      path.join(stageDir, 'vendor-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    )

    if (fs.existsSync(vendorDir)) fs.renameSync(vendorDir, backupDir)
    try {
      fs.renameSync(stageDir, vendorDir)
    } catch (error) {
      if (fs.existsSync(backupDir) && !fs.existsSync(vendorDir)) {
        fs.renameSync(backupDir, vendorDir)
      }
      throw error
    }

    try {
      removePath(backupDir)
    } catch (error) {
      logger.warn(`Published vendor assets but could not remove backup: ${error.message}`)
    }
    return manifest
  } catch (error) {
    removePath(stageDir)
    if (fs.existsSync(backupDir) && !fs.existsSync(vendorDir)) {
      fs.renameSync(backupDir, vendorDir)
    } else if (fs.existsSync(backupDir)) {
      removePath(backupDir)
    }
    throw error
  }
}

module.exports = { collectFiles, publishVendorAssets }
