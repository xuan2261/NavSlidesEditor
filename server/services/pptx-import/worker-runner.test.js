import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import runner from './worker-runner.js'

const { buildParserExecArgv, buildParserWorkerEnv, isParserWorkerResult, runParserWorker } = runner

describe('pptx parser worker runner', () => {
  it('accepts only parser result messages on the IPC channel', () => {
    expect(isParserWorkerResult({ ok: true })).toBe(true)
    expect(isParserWorkerResult({ ok: false, error: { message: 'failed' } })).toBe(true)
    expect(isParserWorkerResult({ 'watch:require': ['parse-worker.js'] })).toBe(false)
    expect(isParserWorkerResult(null)).toBe(false)
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
        "process.on('message',()=>process.send({ok:true, execArgv:process.execArgv}))"
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
        "process.on('message',()=>{process.send({'watch:require':['parse-worker.js']});process.send({ok:true, output:{slides:[1]}})})"
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
        "process.on('message',()=>setTimeout(()=>process.send({ok:true, output:'<slide>secret text</slide>'}),50))"
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
})
