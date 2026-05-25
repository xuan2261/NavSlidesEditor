import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import runner from './worker-runner.js'

const { buildParserExecArgv, buildParserWorkerEnv, getWorkerAckTimeoutMs, isParserWorkerResult, isProgressMessage, isReadyMessage, runParserWorker } = runner

describe('pptx parser worker runner', () => {
  it('accepts only parser result messages on the IPC channel', () => {
    expect(isParserWorkerResult({ ok: true })).toBe(true)
    expect(isParserWorkerResult({ ok: false, error: { message: 'failed' } })).toBe(true)
    expect(isParserWorkerResult({ 'watch:require': ['parse-worker.js'] })).toBe(false)
    expect(isParserWorkerResult(null)).toBe(false)
  })

  it('recognizes ready and progress IPC messages separately from parser results', () => {
    expect(isReadyMessage({ type: 'ready' })).toBe(true)
    expect(isReadyMessage({ ok: true })).toBe(false)
    expect(isProgressMessage({ type: 'progress', stage: 'parse', percent: 10 })).toBe(true)
    expect(isProgressMessage({ type: 'ready' })).toBe(false)
  })

  it('removes Node watch flags from parser worker exec args', () => {
    expect(
      buildParserExecArgv([
        '--watch',
        '--watch-path',
        'server',
        '--watch-path=client',
        '--watch-preserve-output',
        '--trace-warnings',
      ])
    ).toEqual(['--trace-warnings'])
  })

  it('builds module paths and Electron Node mode for packaged workers', () => {
    const repoRoot = path.join(os.tmpdir(), 'navslides-electron-resources')
    const inheritedNodePath = path.join(repoRoot, 'custom-node-modules')
    const env = buildParserWorkerEnv({
      baseEnv: { NODE_PATH: inheritedNodePath },
      repoRoot,
      isElectron: true,
    })
    const nodePathEntries = env.NODE_PATH.split(path.delimiter)

    expect(nodePathEntries[0]).toBe(path.join(repoRoot, 'server', 'node_modules'))
    expect(nodePathEntries[1]).toBe(path.join(repoRoot, 'node_modules'))
    expect(nodePathEntries).toContain(inheritedNodePath)
    expect(env.ELECTRON_RUN_AS_NODE).toBe('1')
  })

  it('does not pass inherited watch flags to the parser worker process', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-argv-'))
    const workerPath = path.join(dir, 'argv-worker.js')
    try {
      await fs.writeFile(
        workerPath,
        "process.on('message',()=>process.send({ok:true, execArgv:process.execArgv}));process.send({type:'ready'})"
      )
      const result = await runParserWorker('deck.pptx', {
        workerPath,
        timeoutMs: 1000,
        execArgv: ['--watch', '--watch-path', 'server', '--watch-preserve-output'],
      })
      expect(result.ok).toBe(true)
      expect(result.execArgv).toEqual([])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('ignores Node watch dependency IPC messages before parser success', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-watch-msg-'))
    const workerPath = path.join(dir, 'watch-message-worker.js')
    try {
      await fs.writeFile(
        workerPath,
        "process.on('message',()=>{process.send({'watch:require':['parse-worker.js']});process.send({ok:true, output:{slides:[1]}})});process.send({type:'ready'})"
      )
      const result = await runParserWorker('deck.pptx', { workerPath, timeoutMs: 1000 })
      expect(result.ok).toBe(true)
      expect(result.output.slides).toEqual([1])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('returns a sanitized timeout failure and ignores late child success', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-'))
    const workerPath = path.join(dir, 'late-worker.js')
    try {
      await fs.writeFile(
        workerPath,
        "process.on('message',()=>setTimeout(()=>process.send({ok:true, output:'<slide>secret text</slide>'}),50));process.send({type:'ready'})"
      )
      const result = await runParserWorker('deck.pptx', { workerPath, timeoutMs: 10 })
      expect(result.ok).toBe(false)
      expect(result.error.type).toBe('parse-failed')
      expect(result.error.message).toContain('timed out')
      expect(result.error.diagnostics || '').not.toContain('<slide>')
      await new Promise((resolve) => setTimeout(resolve, 80))
      expect(result.ok).toBe(false)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('falls back to the default ACK timeout for invalid env values', () => {
    expect(getWorkerAckTimeoutMs(undefined, 1000)).toBe(1000)
    expect(getWorkerAckTimeoutMs('abc', 1000)).toBe(1000)
    expect(getWorkerAckTimeoutMs('-1', 1000)).toBe(1000)
    expect(getWorkerAckTimeoutMs('0', 1000)).toBe(1000)
    expect(getWorkerAckTimeoutMs('250', 1000)).toBe(250)
  })

  it('waits for ready message before sending filePath', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-ready-'))
    const workerPath = path.join(dir, 'ready-worker.js')
    try {
      await fs.writeFile(
        workerPath,
        "let ready=false;process.on('message',()=>process.send({ok:true, receivedBeforeReady:!ready}));setTimeout(()=>{ready=true;process.send({type:'ready'})},50)"
      )
      const result = await runParserWorker('deck.pptx', { workerPath, timeoutMs: 1000, ackTimeoutMs: 500 })
      expect(result.ok).toBe(true)
      expect(result.receivedBeforeReady).toBe(false)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('kills child and returns startup failure when ready is not received', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-no-ready-'))
    const workerPath = path.join(dir, 'no-ready-worker.js')
    try {
      await fs.writeFile(
        workerPath,
        "process.on('message',()=>process.send({ok:true, shouldNotRun:true}))"
      )
      const result = await runParserWorker('deck.pptx', { workerPath, timeoutMs: 1000, ackTimeoutMs: 20 })
      expect(result.ok).toBe(false)
      expect(result.error.type).toBe('worker-startup-failed')
      expect(result.error.message).toContain('ready')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('forwards progress messages and still returns the final parser result', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-progress-'))
    const workerPath = path.join(dir, 'progress-worker.js')
    const progress = []
    try {
      await fs.writeFile(
        workerPath,
        "process.on('message',()=>{process.send({type:'progress',stage:'parse',percent:50});process.send({ok:true, output:{slides:[1]}})});process.send({type:'ready'})"
      )
      const result = await runParserWorker('deck.pptx', {
        workerPath,
        timeoutMs: 1000,
        ackTimeoutMs: 500,
        onProgress: (message) => progress.push(message),
      })
      expect(progress).toEqual([{ type: 'progress', stage: 'parse', percent: 50 }])
      expect(result.ok).toBe(true)
      expect(result.output.slides).toEqual([1])
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('returns a controlled failure when onProgress throws', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-progress-throw-'))
    const workerPath = path.join(dir, 'progress-throw-worker.js')
    try {
      await fs.writeFile(
        workerPath,
        "process.on('message',()=>{process.send({type:'progress',stage:'parse',percent:50});setTimeout(()=>process.send({ok:true, output:{slides:[1]}}),20)});process.send({type:'ready'})"
      )
      const result = await runParserWorker('deck.pptx', {
        workerPath,
        timeoutMs: 1000,
        ackTimeoutMs: 500,
        onProgress: () => {
          throw new Error('progress sink failed')
        },
      })
      expect(result.ok).toBe(false)
      expect(result.error.type).toBe('import-failed')
      expect(result.error.message).toContain('progress sink failed')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('kills child and returns a controlled failure when aborted', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-worker-abort-'))
    const workerPath = path.join(dir, 'abort-worker.js')
    const controller = new AbortController()
    try {
      await fs.writeFile(
        workerPath,
        "process.on('message',()=>setTimeout(()=>process.send({ok:true, output:{slides:[1]}}),200));process.send({type:'ready'})"
      )
      const pending = runParserWorker('deck.pptx', {
        workerPath,
        timeoutMs: 1000,
        ackTimeoutMs: 500,
        signal: controller.signal,
      })
      controller.abort()
      const result = await pending
      expect(result.ok).toBe(false)
      expect(result.error.message).toContain('cancelled')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
