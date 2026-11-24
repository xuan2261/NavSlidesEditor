const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

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

async function writeDurable(filePath, bytes, options, { signal } = {}) {
  signal?.throwIfAborted()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  signal?.throwIfAborted()
  await fs.writeFile(filePath, bytes, options)
  signal?.throwIfAborted()
  await syncFile(filePath)
  signal?.throwIfAborted()
  return syncDirectory(path.dirname(filePath))
}

async function replaceDurable(tempPath, targetPath, { signal, onReplaced } = {}) {
  signal?.throwIfAborted()
  await fs.rename(tempPath, targetPath)
  // Rename is the commit point: cancellation cannot revoke an in-flight success.
  onReplaced?.()
  return syncDirectory(path.dirname(targetPath))
}

// The caller owns this exclusive candidate and must remove it on every failure.
// Do not expose its digest until all canonical bytes have reached stable storage.
async function writeHashedCandidate(filePath, chunks, { signal, onOwned } = {}) {
  signal?.throwIfAborted()
  const handle = await fs.open(filePath, 'wx')
  try {
    onOwned?.()
    const hash = crypto.createHash('sha256')
    // Bounded transient I/O storage, independent of publication admission budgets.
    // Refill only after the entire pending write (including short writes) completes.
    const batch = Buffer.allocUnsafe(1024 * 1024)
    let used = 0
    const drain = async () => {
      signal?.throwIfAborted()
      let offset = 0
      while (offset < used) {
        signal?.throwIfAborted()
        const { bytesWritten } = await handle.write(batch, offset, used - offset)
        if (!Number.isInteger(bytesWritten) || bytesWritten <= 0 || bytesWritten > used - offset) {
          throw new Error('Candidate write made invalid progress')
        }
        hash.update(batch.subarray(offset, offset + bytesWritten))
        offset += bytesWritten
      }
      used = 0
    }
    for (const chunk of chunks) {
      signal?.throwIfAborted()
      const bytes = Buffer.from(chunk, 'utf8')
      let offset = 0
      while (offset < bytes.length) {
        signal?.throwIfAborted()
        const length = Math.min(bytes.length - offset, batch.length - used)
        bytes.copy(batch, used, offset, offset + length)
        used += length
        offset += length
        if (used === batch.length) await drain()
      }
    }
    await drain()
    signal?.throwIfAborted()
    await handle.sync()
    signal?.throwIfAborted()
    return hash.digest('hex')
  } finally {
    await handle.close()
  }
}

// Reuse is a byte-level proof, not an existence check or a hash-only receipt.
// Read through handles in bounded blocks (including short reads).
async function validateExistingCandidate(targetPath, candidatePath, digest, { signal } = {}) {
  let existing
  try {
    existing = await fs.open(targetPath, 'r')
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
  try {
    const stat = await existing.stat()
    if (!stat.isFile()) throw new Error('Conflicting state index: not a regular file')
    const candidate = await fs.open(candidatePath, 'r')
    try {
      if (stat.size !== (await candidate.stat()).size) throw new Error('Conflicting state index: size mismatch')
      const left = Buffer.alloc(64 * 1024)
      const right = Buffer.alloc(left.length)
      const hash = crypto.createHash('sha256')
      const readBlock = async (handle, bytes, position, length) => {
        let offset = 0
        while (offset < length) {
          signal?.throwIfAborted()
          const { bytesRead } = await handle.read(bytes, offset, length - offset, position + offset)
          if (!bytesRead) throw new Error('Conflicting state index: truncated file')
          offset += bytesRead
        }
      }
      for (let position = 0; position < stat.size; position += left.length) {
        const length = Math.min(left.length, stat.size - position)
        await readBlock(existing, left, position, length)
        await readBlock(candidate, right, position, length)
        if (!left.subarray(0, length).equals(right.subarray(0, length))) {
          throw new Error('Conflicting state index: bytes mismatch')
        }
        hash.update(left.subarray(0, length))
      }
      if ((await existing.stat()).size !== stat.size || hash.digest('hex') !== digest) {
        throw new Error('Conflicting state index: hash mismatch')
      }
      signal?.throwIfAborted()
      return true
    } finally {
      await candidate.close()
    }
  } finally {
    await existing.close()
  }
}

module.exports = { replaceDurable, syncDirectory, syncFile, writeDurable, writeHashedCandidate, validateExistingCandidate }
