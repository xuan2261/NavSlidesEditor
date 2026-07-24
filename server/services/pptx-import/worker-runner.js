const { fork } = require('child_process')
const path = require('path')
const { FAILURE_TYPES, PARSER_KILL_GRACE_MS, PARSER_MAX_OLD_SPACE_MB, PARSER_TIMEOUT_MS } = require('./constants')
const { sanitizeDiagnostic } = require('./diagnostics')
const {
  getWorkerAckTimeoutMs,
  isParserWorkerResult,
  isProgressMessage,
  isReadyMessage,
  waitForAck,
} = require('./worker-ipc')

function uniquePathEntries(entries) {
  return entries.filter(Boolean).filter((entry, index, all) => all.indexOf(entry) === index)
}

/** Allowlisted keys for parser worker children (deny secrets by omission). */
const PARSER_WORKER_ENV_ALLOWLIST = new Set([
  'PATH',
  'Path',
  'SystemRoot',
  'WINDIR',
  'TEMP',
  'TMP',
  'TMPDIR',
  'TEMPDIR',
  'LOCALAPPDATA',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'ComSpec',
  'PATHEXT',
  'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE',
  'OS',
  // NODE_PATH is rebuilt below; NODE_OPTIONS intentionally omitted.
])

function buildParserWorkerEnv({ baseEnv = process.env, repoRoot, isElectron } = {}) {
  const root = repoRoot || path.resolve(__dirname, '../../..')
  const nodePath = uniquePathEntries([
    path.join(root, 'server', 'node_modules'),
    path.join(root, 'node_modules'),
    ...(baseEnv.NODE_PATH ? baseEnv.NODE_PATH.split(path.delimiter) : []),
  ]).join(path.delimiter)

  const env = {}
  for (const [key, value] of Object.entries(baseEnv || {})) {
    if (!PARSER_WORKER_ENV_ALLOWLIST.has(key)) continue
    if (typeof value !== 'string') continue
    env[key] = value
  }
  env.NODE_PATH = nodePath

  if (isElectron ?? Boolean(process.versions.electron)) {
    env.ELECTRON_RUN_AS_NODE = '1'
  }

  return env
}

function buildParserExecArgv(execArgv = process.execArgv) {
  const filtered = []
  for (let index = 0; index < execArgv.length; index += 1) {
    const arg = execArgv[index]
    if (arg === '--watch-path') {
      index += 1
      continue
    }
    if (arg === '--watch' || arg.startsWith('--watch-')) continue
    // Drop any inherited heap cap so we can set our own deterministic ceiling.
    if (arg.startsWith('--max-old-space-size')) {
      if (arg === '--max-old-space-size') index += 1
      continue
    }
    filtered.push(arg)
  }
  // Cap parser heap so a parser-side OOM kills the worker, not the host process.
  filtered.push(`--max-old-space-size=${PARSER_MAX_OLD_SPACE_MB}`)
  return filtered
}

function killChild(child, state, graceMs = PARSER_KILL_GRACE_MS) {
  if (!state.exited && !state.closed) child.kill('SIGTERM')
  const escalation = setTimeout(() => {
    if (!state.exited && !state.closed) child.kill('SIGKILL')
  }, graceMs)
  escalation.unref()
  return escalation
}

function runParserWorker(filePath, options = {}) {
  const timeoutMs = options.timeoutMs || PARSER_TIMEOUT_MS
  const ackTimeoutMs = getWorkerAckTimeoutMs(options.ackTimeoutMs)
  const workerPath = options.workerPath || path.join(__dirname, 'parse-worker.js')

  return new Promise((resolve) => {
    const repoRoot = path.resolve(__dirname, '../../..')
    const child = fork(workerPath, [], {
      silent: true,
      windowsHide: true,
      execArgv: buildParserExecArgv(options.execArgv),
      env: buildParserWorkerEnv({ repoRoot }),
    })
    let settled = false
    let stderr = ''
    let stdout = ''
    let ignoredMessages = ''
    const childState = { exited: false, closed: false }
    let resolveClosed
    const workerClosed = new Promise((resolveClosedPromise) => {
      resolveClosed = resolveClosedPromise
    })

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener?.('abort', abortWorker)
      result.workerClosed = workerClosed
      killChild(child, childState, options.killGraceMs)
      resolve(result)
    }

    const abortWorker = () => {
      finish({
        ok: false,
        error: {
          type: FAILURE_TYPES.importFailed,
          message: 'PPTX import cancelled',
          diagnostics: sanitizeDiagnostic(stderr || stdout || ignoredMessages),
        },
      })
    }

    const timer = setTimeout(() => {
      const timeoutSeconds = Math.max(1, Math.round(timeoutMs / 1000))
      finish({
        ok: false,
        error: {
          type: FAILURE_TYPES.parseFailed,
          message: `PPTX parser timed out after ${timeoutSeconds}s`,
          diagnostics: sanitizeDiagnostic(stderr || stdout || ignoredMessages),
        },
      })
    }, timeoutMs)
    if (options.signal?.aborted) return abortWorker()
    options.signal?.addEventListener?.('abort', abortWorker, { once: true })

    child.stdout?.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-2000)
    })
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000)
    })
    child.on('message', (message) => {
      if (settled) return
      if (isReadyMessage(message)) return
      if (isProgressMessage(message)) {
        try {
          options.onProgress?.(message)
        } catch (err) {
          finish({
            ok: false,
            error: {
              type: FAILURE_TYPES.importFailed,
              message: sanitizeDiagnostic(err),
              diagnostics: sanitizeDiagnostic(stderr || stdout || ignoredMessages),
            },
          })
        }
        return
      }
      if (!isParserWorkerResult(message)) {
        ignoredMessages = `${ignoredMessages} ${sanitizeDiagnostic(message)}`.slice(-2000)
        return
      }
      finish(message)
    })
    child.on('error', (err) => {
      finish({
        ok: false,
        error: {
          type: FAILURE_TYPES.importFailed,
          message: sanitizeDiagnostic(err),
          diagnostics: sanitizeDiagnostic(stderr || stdout),
        },
      })
    })
    child.on('exit', (code, signal) => {
      childState.exited = true
      if (settled) return
      finish({
        ok: false,
        error: {
          type: FAILURE_TYPES.parseFailed,
          message: `PPTX parser exited before returning a result (${signal || code})`,
          diagnostics: sanitizeDiagnostic(stderr || stdout || ignoredMessages),
        },
      })
    })

    ;(async () => {
      try {
        await waitForAck(child, ackTimeoutMs)
        if (!settled) child.send({ filePath, originalName: options.originalName || filePath })
      } catch (err) {
        finish({
          ok: false,
          error: {
            type: 'worker-startup-failed',
            message: sanitizeDiagnostic(err),
            diagnostics: sanitizeDiagnostic(stderr || stdout || ignoredMessages),
          },
        })
      }
    })()

    child.on('close', (code, signal) => {
      childState.closed = true
      resolveClosed({ code, signal })
    })
  })
}

module.exports = {
  buildParserExecArgv,
  buildParserWorkerEnv,
  getWorkerAckTimeoutMs,
  isProgressMessage,
  isParserWorkerResult,
  isReadyMessage,
  PARSER_WORKER_ENV_ALLOWLIST,
  runParserWorker,
}
