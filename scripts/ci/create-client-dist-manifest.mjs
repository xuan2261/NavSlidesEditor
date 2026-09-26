import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const SHA256 = /^[a-f0-9]{64}$/
const SUBJECT = /^[a-f0-9]{40}$/
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}
export function normalizedManifestPath(value) {
  if (typeof value !== 'string' || !value || value !== value.normalize('NFC')) {
    throw new Error(`Invalid manifest path: ${String(value)}`)
  }
  if (
    value.includes('\\') ||
    value.includes('\0') ||
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new Error(`Invalid manifest path: ${value}`)
  }
  const parts = value.split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid manifest path: ${value}`)
  }
  if (path.posix.normalize(value) !== value) throw new Error(`Invalid manifest path: ${value}`)
  return value
}
function assertOrdinaryPath(target, description) {
  const stat = fs.lstatSync(target)
  if (stat.isSymbolicLink()) {
    throw new Error(`${description} is a symbolic link or reparse point: ${target}`)
  }
  return stat
}
function assertPathChain(baseDir, target, description) {
  const relative = path.relative(baseDir, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${description} escapes repository root: ${target}`)
  }
  let current = path.resolve(baseDir)
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part)
    assertOrdinaryPath(current, description)
  }
}
export function collectFiles(rootDir) {
  const root = path.resolve(rootDir)
  if (!assertOrdinaryPath(root, 'Artifact root').isDirectory()) {
    throw new Error(`Artifact root is not a directory: ${root}`)
  }
  const files = []
  const foldedPaths = new Set()
  const visit = (directory, prefix = '') => {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareText(left.name, right.name))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      const stat = assertOrdinaryPath(absolute, 'Artifact entry')
      if (entry.name !== entry.name.normalize('NFC')) throw new Error('Artifact entry name must be NFC-normalized')
      const relative = normalizedManifestPath(prefix ? `${prefix}/${entry.name}` : entry.name)
      const folded = relative.toLowerCase()
      if (foldedPaths.has(folded)) throw new Error(`Artifact path collision: ${relative}`)
      foldedPaths.add(folded)
      if (stat.isDirectory()) visit(absolute, relative)
      else if (stat.isFile()) {
        files.push({ path: relative, bytes: stat.size, sha256: sha256File(absolute) })
      } else throw new Error(`Artifact entry is not a regular file: ${relative}`)
    }
  }
  visit(root)
  return files.sort((left, right) => compareText(left.path, right.path))
}

function npmVersion() {
  const agentVersion = process.env.npm_config_user_agent?.match(/^npm\/([^\s]+)/)?.[1]
  if (agentVersion) return agentVersion
  const command =
    process.platform === 'win32'
      ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', '--version']]
      : ['npm', ['--version']]
  return execFileSync(command[0], command[1], { encoding: 'utf8' }).trim()
}

function lockEntry(spec, baseDir) {
  const separator = spec.indexOf('=')
  if (separator < 1) throw new Error(`Invalid lock argument: ${spec}`)
  const name = spec.slice(0, separator)
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) throw new Error(`Invalid lock name: ${name}`)
  const absolute = path.resolve(baseDir, spec.slice(separator + 1))
  const relative = path.relative(baseDir, absolute).replaceAll(path.sep, '/')
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Lock path escapes repository root: ${spec}`)
  }
  assertPathChain(baseDir, absolute, 'Lock file')
  const stat = fs.lstatSync(absolute)
  if (!stat.isFile()) throw new Error(`Lock path is not a file: ${absolute}`)
  return { name, path: normalizedManifestPath(relative), bytes: stat.size, sha256: sha256File(absolute) }
}

export function identityFor(manifest) {
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

export function createManifest(options) {
  const sha = options.subject?.toLowerCase()
  if (!SUBJECT.test(sha || '')) throw new Error('Subject must be a full 40-character SHA')
  if (typeof options.dirty !== 'boolean') throw new Error('Dirty marker must be true or false')
  if (!options.buildCommand) throw new Error('Build command is required')
  if (!options.viteVersion) throw new Error('Vite version is required')
  const defaultLocks = [
    'workspace=package-lock.json',
    'electron-server=electron/server-package-lock.json',
  ].filter((spec) => fs.existsSync(path.resolve(options.baseDir, spec.slice(spec.indexOf('=') + 1))))
  const lockSpecs = options.locks?.length ? options.locks : defaultLocks
  if (!lockSpecs.length) throw new Error('At least one lock file is required')
  const locks = lockSpecs
    .map((spec) => lockEntry(spec, options.baseDir))
    .sort((left, right) => compareText(left.name, right.name))
  if (new Set(locks.map((entry) => entry.name.toLowerCase())).size !== locks.length) {
    throw new Error('Duplicate lock name')
  }
  if (new Set(locks.map((entry) => entry.path.toLowerCase())).size !== locks.length) {
    throw new Error('Duplicate lock path')
  }
  const files = collectFiles(options.root)
  if (!files.length) throw new Error('Client artifact is empty')
  const manifest = {
    schemaVersion: 1,
    subject: { sha, dirty: options.dirty },
    build: {
      command: options.buildCommand,
      node: process.versions.node,
      npm: npmVersion(),
      vite: options.viteVersion,
    },
    locks,
    files,
    artifact: { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) },
  }
  manifest.artifact.identity = identityFor(manifest)
  if (!SHA256.test(manifest.artifact.identity)) throw new Error('Artifact identity generation failed')
  return manifest
}

function parseArgs(args) {
  const values = { locks: [], baseDir: process.cwd() }
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index]
    const value = args[++index]
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--lock') values.locks.push(value)
    else if (key.startsWith('--')) values[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value
    else throw new Error(`Unknown argument: ${key}`)
  }
  if (values.dirty === undefined && process.env.BUILD_DIRTY !== undefined)
    values.dirty = process.env.BUILD_DIRTY
  if (values.dirty === undefined) {
    values.dirty =
      execFileSync('git', ['status', '--porcelain'], {
        cwd: values.baseDir,
        encoding: 'utf8',
      }).trim().length > 0
  } else values.dirty = values.dirty === 'true' ? true : values.dirty === 'false' ? false : values.dirty
  values.subject ||=
    process.env.BUILD_SUBJECT_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: values.baseDir, encoding: 'utf8' }).trim()
  values.buildCommand ||= 'npm run build'
  if (!values.viteVersion) {
    const lock = JSON.parse(fs.readFileSync(path.join(values.baseDir, 'package-lock.json'), 'utf8'))
    values.viteVersion = lock.packages?.['node_modules/vite']?.version
  }
  return values
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const manifest = createManifest(options)
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true })
    fs.writeFileSync(path.resolve(options.out), `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(JSON.stringify({ artifactIdentity: manifest.artifact.identity, files: manifest.files.length }))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
