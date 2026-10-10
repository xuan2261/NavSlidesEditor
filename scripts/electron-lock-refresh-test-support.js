import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { load } from 'js-yaml'

export const branch = 'chore/electron-server-lock-refresh'
export const baseBranch = 'trunk'
const roots = []
export function cleanupLeaseFixtures() {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
}

function bashExecutable() {
  if (process.platform !== 'win32') return 'bash'
  const gitPath = execFileSync('where.exe', ['git'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
  const bash = resolve(dirname(gitPath), '..', 'bin', 'bash.exe')
  if (!existsSync(bash)) throw new Error(`Git Bash is required for workflow behavior tests: ${bash}`)
  return bash
}

// Only GitHub's API is synthetic. Every fetch, commit and push uses native Git and a disposable file:// origin.
const boundaries = `
gh() {
  printf '%s\\n' "$*" >> "$GH_LOG"
  case "$1 $2" in
    'repo view') printf '%s\\n' "$FIXTURE_BASE" ;;
    'pr list') printf '%s\\n' "$OPEN_PR" ;;
    'pr create') return "$DENY_PR" ;;
    *) return 97 ;;
  esac
}
git() {
  if [[ "$1" == push && "$INJECT_WINNER" == 1 ]]; then
    INJECT_WINNER=0
    command git -C "$SEED" checkout -B "$AUTOMATION_BRANCH" || return
    printf '%s\\n' 'concurrent winner lock' > "$SEED/electron/server-package-lock.json"
    command git -C "$SEED" add electron/server-package-lock.json || return
    command git -C "$SEED" commit -m 'concurrent winner' || return
    command git -C "$SEED" push origin "$AUTOMATION_BRANCH" || return
    command git -C "$SEED" rev-parse HEAD > "$WINNER_TIP" || return
    # A background fetch must not replace the explicitly observed push authority.
    command git fetch --no-tags origin "+refs/heads/$AUTOMATION_BRANCH:refs/remotes/origin/$AUTOMATION_BRANCH" || return
  fi
  command git "$@"
}
`

export function leaseFixture({ existing = false, changed = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'navslides-lock-lease-test-'))
  roots.push(root)
  const seed = join(root, 'seed')
  const origin = join(root, 'origin.git')
  const checkout = join(root, 'checkout')
  const ghLog = join(root, 'gh.log')
  const output = join(root, 'output.txt')
  const winnerTip = join(root, 'winner-tip.txt')
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'gitconfig'),
    GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0', GIT_AUTHOR_DATE: '2026-10-09T10:00:00Z',
    GIT_COMMITTER_DATE: '2026-10-09T10:00:00Z', GH_TOKEN: '', GITHUB_TOKEN: '' }
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', timeout: 10000 }).trim()
  mkdirSync(seed)
  git(root, 'init', '--bare', origin)
  git(seed, 'init', '--initial-branch', baseBranch)
  git(seed, 'config', 'user.name', 'Lease fixture')
  git(seed, 'config', 'user.email', 'lease@example.invalid')
  git(seed, 'config', 'core.autocrlf', 'false')
  git(seed, 'config', 'commit.gpgsign', 'false')
  mkdirSync(join(seed, 'electron'))
  writeFileSync(join(seed, 'electron/server-package-lock.json'), 'base lock\n')
  git(seed, 'add', '.')
  git(seed, 'commit', '-m', 'default branch fixture')
  git(seed, 'remote', 'add', 'origin', pathToFileURL(origin).href)
  git(seed, 'push', 'origin', baseBranch)
  const baseTip = git(seed, 'rev-parse', 'HEAD')
  if (existing) {
    git(seed, 'checkout', '-b', branch)
    writeFileSync(join(seed, 'electron/server-package-lock.json'), 'previous refresh\n')
    git(seed, 'add', '.')
    git(seed, 'commit', '-m', 'previous refresh')
    git(seed, 'push', 'origin', branch)
  }
  // Reproduce checkout v4's default depth-one single-default-branch fetch.
  git(root, 'clone', '--depth=1', '--single-branch', '--branch', baseBranch, pathToFileURL(origin).href, checkout)
  git(checkout, 'config', 'core.autocrlf', 'false')
  git(checkout, 'config', 'commit.gpgsign', 'false')
  if (changed) writeFileSync(join(checkout, 'electron/server-package-lock.json'), 'refreshed lock\n')
  writeFileSync(ghLog, '')
  writeFileSync(output, '')
  const remoteTip = () => {
    const refs = git(root, '--git-dir', origin, 'for-each-ref', '--format=%(objectname)', `refs/heads/${branch}`)
    return refs || null
  }
  const originalTip = remoteTip()
  return {
    originalTip, baseTip, remoteTip,
    checkoutTip: () => git(checkout, 'rev-parse', 'HEAD'),
    baseTipAfter: () => git(root, '--git-dir', origin, 'rev-parse', `refs/heads/${baseBranch}`),
    remoteLock: () => git(root, '--git-dir', origin, 'show', `refs/heads/${branch}:electron/server-package-lock.json`),
    winnerTip: () => readFileSync(winnerTip, 'utf8').trim(),
    disconnectOrigin: () => git(checkout, 'remote', 'set-url', 'origin', pathToFileURL(join(root, 'unavailable.git')).href),
    trackingRefs: () => git(checkout, 'for-each-ref', '--format=%(refname)', 'refs/remotes/origin'),
    ghCalls: () => readFileSync(ghLog, 'utf8').trim().split('\n').filter(Boolean),
    outputs: () => readFileSync(output, 'utf8'),
    run({ step = 'Open or update the refresh PR', openPr = '', denyPr = false, concurrent = false } = {}) {
      const workflow = load(readFileSync(new URL('../.github/workflows/electron-server-lock-refresh.yml', import.meta.url), 'utf8'))
      const body = workflow.jobs.refresh.steps.find((entry) => entry.name === step)?.run
      if (typeof body !== 'string') throw new Error(`Missing executable workflow step: ${step}`)
      const result = spawnSync(bashExecutable(), ['--noprofile', '--norc', '-s'], {
        cwd: checkout, input: boundaries + '\n' + body.replaceAll('${{ github.repository }}', 'fixture/navslides'),
        encoding: 'utf8', timeout: 20000,
        env: { ...env, BASE: baseBranch, FIXTURE_BASE: baseBranch, GITHUB_OUTPUT: output.replaceAll('\\', '/'),
          GH_LOG: ghLog.replaceAll('\\', '/'), OPEN_PR: openPr, DENY_PR: denyPr ? '1' : '0',
          INJECT_WINNER: concurrent ? '1' : '0', SEED: seed.replaceAll('\\', '/'),
          WINNER_TIP: winnerTip.replaceAll('\\', '/'), AUTOMATION_BRANCH: branch },
      })
      if (result.error) throw result.error
      return result
    },
  }
}
