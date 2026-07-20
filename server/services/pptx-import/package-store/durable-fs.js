const fs = require('node:fs/promises')
const path = require('node:path')

async function syncFile(filePath) {
  const handle = await fs.open(filePath, process.platform === 'win32' ? 'r+' : 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncDirectory(dirPath) {
  if (process.platform === 'win32') {
    return { supported: false, platform: 'win32', reason: 'directory-fsync-unavailable' }
  }
  const handle = await fs.open(dirPath, 'r')
  try {
    await handle.sync()
    return { supported: true, platform: process.platform }
  } finally {
    await handle.close()
  }
}

async function writeDurable(filePath, bytes, options) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, bytes, options)
  await syncFile(filePath)
  return syncDirectory(path.dirname(filePath))
}

async function replaceDurable(tempPath, targetPath) {
  await fs.rename(tempPath, targetPath)
  return syncDirectory(path.dirname(targetPath))
}

module.exports = { replaceDurable, syncDirectory, syncFile, writeDurable }
