import { execFileSync } from 'node:child_process'
import path from 'node:path'

const FULL_SHA = /^[0-9a-f]{40}$/

function git(root, ...args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch {
    throw new Error('Git source identity is unavailable')
  }
}

export function requireCleanGitSubject(root) {
  const gitRoot = git(root, 'rev-parse', '--show-toplevel').trim()
  if (path.resolve(gitRoot).toLowerCase() !== path.resolve(root).toLowerCase()) {
    throw new Error('Source directory is not the repository root')
  }
  const commit = git(root, 'rev-parse', '--verify', 'HEAD^{commit}').trim()
  if (!FULL_SHA.test(commit)) throw new Error('Source commit is not a full SHA')
  if (git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all')) {
    throw new Error('Source worktree must be clean, including untracked files')
  }
  const entries = git(root, 'ls-files', '-v', '-z').split('\0')
  if (entries.some((entry) => entry && entry[0] !== 'H')) {
    throw new Error('Source worktree has hidden or nonstandard Git index flags')
  }
  return {
    commit,
    worktree: { clean: true, trackedClean: true, untrackedClean: true },
  }
}
