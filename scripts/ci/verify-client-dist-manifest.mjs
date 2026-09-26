import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  collectFiles,
  identityFor,
  normalizedManifestPath,
  sha256File,
} from './create-client-dist-manifest.mjs'

const SHA256 = /^[a-f0-9]{64}$/
const SUBJECT = /^[a-f0-9]{40}$/
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)

function exactKeys(value, expected, label) {
  const keys = Object.keys(value || {}).sort()
  if (JSON.stringify(keys) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} fields are invalid`)
  }
}

function validateEntries(entries, label) {
  if (!Array.isArray(entries) || !entries.length) throw new Error(`${label} list is invalid`)
  const exact = new Set()
  const folded = new Set()
  const names = new Set()
  for (const entry of entries) {
    const entryPath = normalizedManifestPath(entry?.path)
    if (exact.has(entryPath)) throw new Error(`Duplicate ${label} path: ${entryPath}`)
    if (folded.has(entryPath.toLowerCase())) throw new Error(`${label} path collision: ${entryPath}`)
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !SHA256.test(entry.sha256 || '')) {
      throw new Error(`Invalid ${label} entry: ${entryPath}`)
    }
    exactKeys(entry, label === 'lock' ? ['name', 'path', 'bytes', 'sha256'] : ['path', 'bytes', 'sha256'], `${label} entry`)
    if (label === 'lock' && !/^[a-z0-9][a-z0-9._-]*$/i.test(entry.name || '')) {
      throw new Error(`Invalid lock name: ${entry.name}`)
    }
    if (label === 'lock' && names.has(entry.name.toLowerCase())) {
      throw new Error(`Duplicate lock name: ${entry.name}`)
    }
    if (label === 'lock') names.add(entry.name.toLowerCase())
    exact.add(entryPath)
    folded.add(entryPath.toLowerCase())
  }
}

function expectedLock(spec, baseDir) {
  const separator = spec.indexOf('=')
  if (separator < 1) throw new Error(`Invalid lock argument: ${spec}`)
  const name = spec.slice(0, separator)
  const absolute = path.resolve(baseDir, spec.slice(separator + 1))
  const relative = path.relative(baseDir, absolute).replaceAll(path.sep, '/')
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Lock path escapes repository root: ${spec}`)
  }
  let current = path.resolve(baseDir)
  for (const part of path.relative(baseDir, absolute).split(path.sep)) {
    current = path.join(current, part)
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Lock file is a symbolic link or reparse point: ${name}`)
    }
  }
  const stat = fs.lstatSync(absolute)
  return { name, path: normalizedManifestPath(relative), bytes: stat.size, sha256: sha256File(absolute) }
}

export function verifyManifest(options) {
  const manifestPath = path.resolve(options.manifest)
  if (fs.lstatSync(manifestPath).isSymbolicLink()) {
    throw new Error('Client manifest is a symbolic link or reparse point')
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest?.schemaVersion !== 1) throw new Error('Unsupported client manifest schema')
  exactKeys(manifest, ['schemaVersion', 'subject', 'build', 'locks', 'files', 'artifact'], 'Manifest')
  exactKeys(manifest.subject, ['sha', 'dirty'], 'Subject')
  exactKeys(manifest.build, ['command', 'node', 'npm', 'vite'], 'Build')
  exactKeys(manifest.artifact, ['files', 'bytes', 'identity'], 'Artifact')
  if (!SUBJECT.test(manifest.subject?.sha || '') || typeof manifest.subject?.dirty !== 'boolean') {
    throw new Error('Client manifest subject is invalid')
  }
  if (manifest.subject.sha !== options.subject?.toLowerCase()) throw new Error('Subject SHA mismatch')
  if (manifest.subject.dirty !== options.dirty) throw new Error('Dirty marker mismatch')
  if (manifest.build?.command !== options.buildCommand) throw new Error('Build command mismatch')
  for (const field of ['node', 'npm', 'vite']) {
    if (typeof manifest.build?.[field] !== 'string' || !manifest.build[field]) {
      throw new Error(`Build ${field} version is invalid`)
    }
  }
  validateEntries(manifest.files, 'artifact')
  validateEntries(manifest.locks, 'lock')
  const sortedFiles = [...manifest.files].sort((left, right) => compareText(left.path, right.path))
  const sortedLocks = [...manifest.locks].sort((left, right) => compareText(left.name, right.name))
  if (JSON.stringify(sortedFiles) !== JSON.stringify(manifest.files)) throw new Error('Artifact paths are not sorted')
  if (JSON.stringify(sortedLocks) !== JSON.stringify(manifest.locks)) throw new Error('Lock paths are not sorted')
  if (
    !Number.isSafeInteger(manifest.artifact?.files) ||
    !Number.isSafeInteger(manifest.artifact?.bytes) ||
    !SHA256.test(manifest.artifact?.identity || '')
  ) {
    throw new Error('Artifact summary is invalid')
  }
  if (identityFor(manifest) !== manifest.artifact.identity) throw new Error('Artifact identity mismatch')

  const lockSpecs = options.locks?.length
    ? options.locks
    : manifest.locks.map((entry) => `${entry.name}=${entry.path}`)
  const expectedLocks = lockSpecs
    .map((spec) => expectedLock(spec, options.baseDir))
    .sort((left, right) => compareText(left.name, right.name))
  if (JSON.stringify(expectedLocks) !== JSON.stringify(manifest.locks)) throw new Error('Lock hash mismatch')

  const actualFiles = collectFiles(options.root)
  const declared = new Map(manifest.files.map((entry) => [entry.path, entry]))
  const actual = new Map(actualFiles.map((entry) => [entry.path, entry]))
  for (const entry of manifest.files) {
    const found = actual.get(entry.path)
    if (!found) throw new Error(`Artifact file missing: ${entry.path}`)
    if (found.bytes !== entry.bytes) throw new Error(`Client artifact size mismatch: ${entry.path}`)
    if (found.sha256 !== entry.sha256) throw new Error(`Client artifact hash mismatch: ${entry.path}`)
  }
  for (const entry of actualFiles) {
    if (!declared.has(entry.path)) throw new Error(`Artifact file extra: ${entry.path}`)
  }
  const bytes = actualFiles.reduce((sum, entry) => sum + entry.bytes, 0)
  if (manifest.artifact.files !== actualFiles.length || manifest.artifact.bytes !== bytes) {
    throw new Error('Artifact summary mismatch')
  }
  return { artifactIdentity: manifest.artifact.identity, files: actualFiles.length, bytes }
}

function parseArgs(args) {
  const values = { locks: [], baseDir: process.cwd(), dirty: false, buildCommand: 'npm run build' }
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index]
    const value = args[++index]
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--lock') values.locks.push(value)
    else if (key.startsWith('--')) values[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
    else throw new Error(`Unknown argument: ${key}`)
  }
  values.dirty = values.dirty === 'true' ? true : values.dirty === 'false' ? false : values.dirty
  return values
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(verifyManifest(parseArgs(process.argv.slice(2)))))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
