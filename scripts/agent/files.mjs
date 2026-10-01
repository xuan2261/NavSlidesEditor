import { constants } from 'node:fs'
import { open, lstat, realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AgentError } from './contracts.mjs'

export const MAX_FILE_BYTES = 100 * 1024 * 1024
const defaultRoot = fileURLToPath(new URL('../../', import.meta.url))

export function assertWritable(api) {
  if (api?.readOnly) throw new AgentError('READ_ONLY', 'File writes, imports and uploads are disabled in read-only mode.', 'Restart without --read-only only after authorizing this operation.')
}

export function checkCancelled(signal) {
  if (signal?.aborted) throw new AgentError('CANCELLED', 'The operation was cancelled.', 'No new work will be started; inspect any previously returned import job handle.')
}

function contain(root, target) {
  const relative = path.relative(root, target)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new AgentError('PATH_OUTSIDE_WORKSPACE', 'The file path escapes NAVSLIDES_WORKSPACE.', 'Use a path inside the configured workspace; symlinks cannot escape it.')
  }
}

function fileError(error) {
  if (error instanceof AgentError) return error
  const messages = {
    ENOENT: ['FILE_NOT_FOUND', 'The file or its parent directory does not exist.', 'Create the parent directory inside NAVSLIDES_WORKSPACE, or correct the input path.'],
    EEXIST: ['FILE_EXISTS', 'The output file already exists.', 'Choose another path or explicitly set overwrite:true.'],
    EACCES: ['FILE_ACCESS_DENIED', 'The workspace file is not accessible.', 'Check local file permissions and close programs locking the output.'],
    EPERM: ['FILE_ACCESS_DENIED', 'The workspace file is not accessible.', 'Check local file permissions and close programs locking the output.'],
    ELOOP: ['UNSAFE_SYMLINK', 'The file is an unsafe or looping symlink.', 'Choose a regular file inside NAVSLIDES_WORKSPACE.'],
  }
  const [code, message, hint] = messages[error.code] || ['FILE_IO_FAILED', 'The local file operation failed.', 'Check the path, free disk space and file permissions inside NAVSLIDES_WORKSPACE.']
  return new AgentError(code, message, hint)
}

/** Resolve lexical and real paths; output directories must already exist. */
export async function resolveLocalPath(file, { write = false, overwrite = false, readOnly = false } = {}) {
  if (write) assertWritable({ readOnly })
  if (typeof file !== 'string' || !file.trim() || file.includes('\0') || file.split(/[\\/]/).includes('..')) {
    throw new AgentError('INVALID_PATH', 'A nonempty local file path without traversal is required.', 'Supply a relative or absolute path inside NAVSLIDES_WORKSPACE.')
  }
  try {
    const configuredRoot = path.resolve(process.env.NAVSLIDES_WORKSPACE || defaultRoot)
    const root = await realpath(configuredRoot)
    const requested = path.resolve(configuredRoot, file)
    // Accept the configured spelling and the canonical spelling of a symlinked root.
    const relativeToRoot = path.relative(root, requested)
    const insideRoot = relativeToRoot !== '..' && !relativeToRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeToRoot)
    const lexicalRoot = path.isAbsolute(file) && insideRoot ? root : configuredRoot
    contain(lexicalRoot, requested)
    let parent = root
    let cursor = lexicalRoot
    const segments = path.relative(lexicalRoot, path.dirname(requested)).split(path.sep).filter(Boolean)
    for (const segment of segments) {
      cursor = path.join(cursor, segment)
      parent = await realpath(cursor)
      contain(root, parent)
    }
    const target = path.join(parent, path.basename(requested))
    let stat
    try { stat = await lstat(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (!stat) {
      if (!write) throw Object.assign(new Error(), { code: 'ENOENT' })
      return target
    }
    const resolved = await realpath(target)
    contain(root, resolved)
    if (write && stat.isSymbolicLink()) throw new AgentError('UNSAFE_SYMLINK', 'Output files cannot be symlinks.', 'Choose a regular output file within NAVSLIDES_WORKSPACE.')
    if (!stat.isSymbolicLink() && !stat.isFile()) throw new AgentError('NOT_REGULAR_FILE', 'The path is not a regular file.', 'Choose a regular file, not a directory or device.')
    if (write && !overwrite) throw new AgentError('FILE_EXISTS', 'The output file already exists.', 'Choose another path or explicitly set overwrite:true.')
    return resolved
  } catch (error) { throw fileError(error) }
}

export async function readLocalFile(file, { signal } = {}) {
  checkCancelled(signal)
  let handle
  try {
    const resolved = await resolveLocalPath(file)
    handle = await open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
    const stat = await handle.stat()
    if (!stat.isFile()) throw new AgentError('NOT_REGULAR_FILE', 'Import inputs must be regular files.', 'Choose a regular local file inside NAVSLIDES_WORKSPACE.')
    if (stat.size > MAX_FILE_BYTES) throw new AgentError('FILE_TOO_LARGE', 'Local file inputs cannot exceed 100 MiB.', 'Reduce the input size before importing or uploading.')
    checkCancelled(signal)
    const buffer = await handle.readFile({ signal })
    if (buffer.byteLength > MAX_FILE_BYTES) throw new AgentError('FILE_TOO_LARGE', 'The file exceeded 100 MiB while being read.', 'Use a stable file no larger than 100 MiB.')
    return { path: resolved, buffer, name: path.basename(file) }
  } catch (error) {
    checkCancelled(signal)
    throw fileError(error)
  } finally { if (handle) await handle.close() }
}

export async function writeLocalFile(file, bytes, { overwrite = false, readOnly = false, signal } = {}) {
  assertWritable({ readOnly })
  checkCancelled(signal)
  let handle
  try {
    const resolved = await resolveLocalPath(file, { write: true, overwrite, readOnly })
    const flags = overwrite ? constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW || 0) : 'wx'
    handle = await open(resolved, flags, 0o600)
    await handle.writeFile(bytes, { signal })
    const stat = await handle.stat()
    return { path: resolved, bytes: stat.size }
  } catch (error) {
    checkCancelled(signal)
    throw fileError(error)
  } finally { if (handle) await handle.close() }
}
