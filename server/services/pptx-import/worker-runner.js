const { fork } = require('child_process')
const path = require('path')
const { FAILURE_TYPES, PARSER_KILL_GRACE_MS, PARSER_TIMEOUT_MS } = require('./constants')
const { sanitizeDiagnostic } = require('./diagnostics')

function uniquePathEntries(entries) {
  return entries.filter(Boolean).filter((entry, index, all) => all.indexOf(entry) === index)
}

function buildParserWorkerEnv({ baseEnv = process.env, repoRoot, isElectron } = {}) {
  const root = repoRoot || path.resolve(__dirname, '../../..')
  const nodePath = uniquePathEntries([
    path.join(root, 'server', 'node_modules'),
    path.join(root, 'node_modules'),
    ...(baseEnv.NODE_PATH ? baseEnv.NODE_PATH.split(path.delimiter) : []),
  ]).join(path.delimiter)
  const env = {
    ...baseEnv,
    NODE_PATH: nodePath,
  }

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
    filtered.push(arg)
  }
  return filtered
}

function killChild(child) {
  if (!child.killed) child.kill('SIGTERM')
  setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL')
  }, PARSER_KILL_GRACE_MS).unref()
}

function isParserWorkerResult(message) {
  return Boolean(message && typeof message === 'object' && typeof message.ok === 'boolean')
}

function runParserWorker(filePath, options = {}) {
  const timeoutMs = options.timeoutMs || PARSER_TIMEOUT_MS
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

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      killChild(child)
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({
        ok: false,
        error: {
          type: FAILURE_TYPES.parseFailed,
          message: 'PPTX parser timed out after 60s',
          diagnostics: sanitizeDiagnostic(stderr || stdout || ignoredMessages),
        },
      })
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-2000)
    })
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000)
    })
    child.on('message', (message) => {
      if (settled) return
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

    child.send({ filePath })
  })
}

module.exports = {
  buildParserExecArgv,
  buildParserWorkerEnv,
  isParserWorkerResult,
  runParserWorker,
}
