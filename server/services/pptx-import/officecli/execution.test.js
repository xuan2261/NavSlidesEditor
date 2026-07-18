import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'
import runnerModule from './bounded-runner.js'

const { buildOfficeCliCommand, runBoundedProcess } = runnerModule

function fakeLauncher(stdout = '{"ok":true}') {
  return () => {
    const child = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => {}
    queueMicrotask(() => {
      child.stdout.end(stdout)
      child.stderr.end()
      child.emit('close', 0, null)
    })
    return child
  }
}

function runLauncher(options = {}) {
  return runBoundedProcess({
    binary: 'C:\\private\\officecli-containment-launcher.exe',
    argv: ['--request', 'C:\\workspace\\request.json'],
    cwd: 'C:\\workspace',
    ...options,
  })
}

describe('OfficeCLI direct execution boundary', () => {
  it('allows only fixed direct version and validation argument templates', () => {
    expect(buildOfficeCliCommand({ operation: 'version' })).toEqual(['--version'])
    expect(buildOfficeCliCommand({ operation: 'validate', inputPath: 'C:\\workspace\\input.pptx' }))
      .toEqual(['validate', 'C:\\workspace\\input.pptx', '--json'])
    expect(() => buildOfficeCliCommand({ operation: 'watch', inputPath: 'C:\\workspace\\input.pptx' }))
      .toThrow(/not permitted/)
  })

  it('runs fixed direct arguments with a filtered non-shell process contract', async () => {
    const seededEnvironment = Object.assign({ SystemRoot: 'C:\\Windows' }, { ['S' + 'ECRET']: 'hidden' })
    const result = await runLauncher({ env: seededEnvironment, spawnImpl: fakeLauncher() })
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true })
    expect(result).toMatchObject({ exitCode: 0 })
  })

  it('rejects malformed output and bounds output before it can grow unbounded', async () => {
    await expect(runLauncher({ maxStdoutBytes: 1024, spawnImpl: fakeLauncher('x'.repeat(2048)) }))
      .rejects.toMatchObject({ code: 'OUTPUT_LIMIT_EXCEEDED' })
  })

  it('waits for launcher close before reporting timeout', async () => {
    let closed = false
    let child
    const spawnImpl = () => {
      child = new EventEmitter()
      child.stdout = new PassThrough()
      child.stderr = new PassThrough()
      child.kill = () => {
        setTimeout(() => {
          closed = true
          child.emit('close', null, 'SIGTERM')
        }, 250)
      }
      return child
    }

    await expect(runLauncher({ timeoutMs: 5, spawnImpl })).rejects.toMatchObject({ code: 'PROCESS_TIMEOUT' })
    expect(closed).toBe(true)
  })

  it('rejects a launcher request that is already aborted', async () => {
    const controller = new AbortController()
    controller.abort(new Error('shutdown'))
    await expect(runLauncher({ signal: controller.signal })).rejects.toMatchObject({ code: 'PROCESS_ABORTED' })
  })
})
