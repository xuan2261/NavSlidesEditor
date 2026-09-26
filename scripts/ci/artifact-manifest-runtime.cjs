const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const SHA256 = /^[a-f0-9]{64}$/
const SUBJECT = /^[a-f0-9]{40}$/
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

function exactKeys(value, expected, label) {
  const keys = Object.keys(value || {}).sort()
  if (JSON.stringify(keys) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} fields are invalid`)
  }
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function normalizeEntryPath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.normalize('NFC') ||
    value.includes('\\') ||
    value.includes('\0') ||
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`Invalid client manifest path: ${String(value)}`)
  }
  const parts = value.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid client manifest path: ${value}`)
  }
  return value
}

function collectFiles(rootDir) {
  const rootStat = fs.lstatSync(rootDir)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error('Client artifact root is a symbolic link, reparse point, or non-directory')
  }
  const files = []
  const folded = new Set()
  const visit = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      const stat = fs.lstatSync(absolute)
      if (stat.isSymbolicLink()) {
        throw new Error(`Client artifact contains a symbolic link or reparse point: ${entry.name}`)
      }
      if (entry.name !== entry.name.normalize('NFC')) {
        throw new Error('Client artifact entry name must be NFC-normalized')
      }
      const relative = normalizeEntryPath(prefix ? `${prefix}/${entry.name}` : entry.name)
      if (folded.has(relative.toLowerCase())) {
        throw new Error(`Client artifact path collision: ${relative}`)
      }
      folded.add(relative.toLowerCase())
      if (stat.isDirectory()) visit(absolute, relative)
      else if (stat.isFile()) {
        files.push({ path: relative, bytes: stat.size, sha256: hashFile(absolute) })
      } else throw new Error(`Client artifact entry is not a regular file: ${relative}`)
    }
  }
  visit(rootDir)
  return files.sort((left, right) => compareText(left.path, right.path))
}

function validateEntries(entries, label, sortKey) {
  if (!Array.isArray(entries) || !entries.length) throw new Error(`Client ${label} list is invalid`)
  const exact = new Set()
  const folded = new Set()
  const names = new Set()
  for (const entry of entries) {
    const entryPath = normalizeEntryPath(entry?.path)
    if (exact.has(entryPath) || folded.has(entryPath.toLowerCase())) {
      throw new Error(`Duplicate or case-colliding client ${label} path: ${entryPath}`)
    }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !SHA256.test(entry.sha256 || '')) {
      throw new Error(`Invalid client ${label} entry: ${entryPath}`)
    }
    exactKeys(
      entry,
      label === 'lock' ? ['name', 'path', 'bytes', 'sha256'] : ['path', 'bytes', 'sha256'],
      `Client ${label} entry`
    )
    if (label === 'lock' && !/^[a-z0-9][a-z0-9._-]*$/i.test(entry.name || '')) {
      throw new Error(`Invalid client lock name: ${entry.name}`)
    }
    if (label === 'lock' && names.has(entry.name.toLowerCase())) {
      throw new Error(`Duplicate client lock name: ${entry.name}`)
    }
    if (label === 'lock') names.add(entry.name.toLowerCase())
    exact.add(entryPath)
    folded.add(entryPath.toLowerCase())
  }
  const sorted = [...entries].sort((left, right) => compareText(left[sortKey], right[sortKey]))
  if (JSON.stringify(sorted) !== JSON.stringify(entries)) {
    throw new Error(`Client ${label} entries are not sorted`)
  }
}

function identityFor(manifest) {
  const document = {
    schemaVersion: manifest.schemaVersion,
    subject: manifest.subject,
    build: manifest.build,
    locks: manifest.locks,
    files: manifest.files,
    artifact: { files: manifest.artifact.files, bytes: manifest.artifact.bytes },
  }
  return crypto.createHash('sha256').update(JSON.stringify(document)).digest('hex')
}

function verifyClientArtifact({ rootDir, manifestPath, expectedSubject }) {
  if (fs.lstatSync(manifestPath).isSymbolicLink()) {
    throw new Error('Client manifest is a symbolic link or reparse point')
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest?.schemaVersion !== 1) throw new Error('Unsupported client manifest schema')
  exactKeys(manifest, ['schemaVersion', 'subject', 'build', 'locks', 'files', 'artifact'], 'Client manifest')
  exactKeys(manifest.subject, ['sha', 'dirty'], 'Client subject')
  exactKeys(manifest.build, ['command', 'node', 'npm', 'vite'], 'Client build')
  exactKeys(manifest.artifact, ['files', 'bytes', 'identity'], 'Client artifact')
  if (!SUBJECT.test(manifest.subject?.sha || '') || typeof manifest.subject?.dirty !== 'boolean') {
    throw new Error('Client manifest subject must bind a full SHA and dirty marker')
  }
  if (expectedSubject && manifest.subject.sha !== expectedSubject.toLowerCase()) {
    throw new Error('Client manifest subject mismatch')
  }
  for (const field of ['command', 'node', 'npm', 'vite']) {
    if (typeof manifest.build?.[field] !== 'string' || !manifest.build[field]) {
      throw new Error(`Client build ${field} is invalid`)
    }
  }
  validateEntries(manifest.files, 'artifact', 'path')
  validateEntries(manifest.locks, 'lock', 'name')
  if (!SHA256.test(manifest.artifact?.identity || '')) {
    throw new Error('Client artifact identity is invalid')
  }
  if (identityFor(manifest) !== manifest.artifact.identity) {
    throw new Error('Client artifact identity mismatch')
  }
  const actualFiles = collectFiles(rootDir)
  const actual = new Map(actualFiles.map((entry) => [entry.path, entry]))
  const declared = new Set(manifest.files.map((entry) => entry.path))
  for (const entry of manifest.files) {
    const found = actual.get(entry.path)
    if (!found) throw new Error(`Client artifact file missing: ${entry.path}`)
    if (found.bytes !== entry.bytes) throw new Error(`Client artifact size mismatch: ${entry.path}`)
    if (found.sha256 !== entry.sha256) throw new Error(`Client artifact hash mismatch: ${entry.path}`)
  }
  for (const entry of actualFiles) {
    if (!declared.has(entry.path)) throw new Error(`Client artifact file extra: ${entry.path}`)
  }
  const bytes = actualFiles.reduce((sum, entry) => sum + entry.bytes, 0)
  if (manifest.artifact.files !== actualFiles.length || manifest.artifact.bytes !== bytes) {
    throw new Error('Client artifact summary mismatch')
  }
  return { identity: manifest.artifact.identity, subject: manifest.subject.sha, files: actualFiles.length }
}

module.exports = { verifyClientArtifact }
