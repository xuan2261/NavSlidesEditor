const { EventEmitter } = require('events')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createFailedResult, runOne, validateFailureType } = require('./run-all')

describe('run-all failure handling', () => {
  it('uses null peak memory for parent-synthesized failures', () => {
    const researchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-run-all-'))
    const sandboxRoot = path.join(researchRoot, 'parser-sandbox')
    fs.mkdirSync(sandboxRoot, { recursive: true })
    fs.writeFileSync(path.join(sandboxRoot, 'package.json'), '{}')

    const result = createFailedResult({
      parser: 'pptxtojson',
      deck: 'missing.pptx',
      researchRoot,
      sandboxRoot,
      error: { type: 'parse-failed', message: 'Missing corpus inventory for missing.pptx.' },
    })

    expect(result.ok).toBe(false)
    expect(result.peakMemoryMb).toBeNull()
    expect(result.error.type).toBe('parse-failed')
    expect(fs.existsSync(path.join(researchRoot, 'parser-summary', 'pptxtojson', 'missing.json')))
      .toBe(true)
  })

  it('normalizes unknown failure taxonomy to parse-failed', () => {
    const result = { ok: false, error: { type: 'inventory-missing' } }
    validateFailureType(result)

    expect(result.error.type).toBe('parse-failed')
  })

  it('drains and redacts child stdout and stderr when the child exits', async () => {
    const researchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-run-one-'))
    const sandboxRoot = path.join(researchRoot, 'parser-sandbox')
    const childPath = path.join(researchRoot, 'child-exit.js')
    fs.mkdirSync(sandboxRoot, { recursive: true })
    fs.writeFileSync(path.join(sandboxRoot, 'package.json'), '{}')
    fs.writeFileSync(childPath, `
process.stdout.write('secret slide stdout text')
process.stderr.write('secret slide stderr text')
process.exit(1)
`)

    const result = await runOne({
      parser: 'pptxtojson',
      deck: 'deck.pptx',
      inputPath: path.join(researchRoot, 'deck.pptx'),
      researchRoot,
      sandboxRoot,
      inventory: { deck: 'deck' },
      childPath,
      timeoutMs: 500,
    })

    expect(result.ok).toBe(false)
    expect(result.error.type).toBe('parse-failed')
    expect(result.error.message).toContain('Diagnostic redacted')
    expect(result.error.message).not.toContain('secret slide')
  })

  it('returns a structured failure when the child times out', async () => {
    const researchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-run-timeout-'))
    const sandboxRoot = path.join(researchRoot, 'parser-sandbox')
    const childPath = path.join(researchRoot, 'child-timeout.js')
    fs.mkdirSync(sandboxRoot, { recursive: true })
    fs.writeFileSync(path.join(sandboxRoot, 'package.json'), '{}')
    fs.writeFileSync(childPath, `
process.stdout.write('timeout secret text')
setInterval(() => {}, 1000)
`)

    const result = await runOne({
      parser: 'pptxtojson',
      deck: 'timeout.pptx',
      inputPath: path.join(researchRoot, 'timeout.pptx'),
      researchRoot,
      sandboxRoot,
      inventory: { deck: 'timeout' },
      childPath,
      timeoutMs: 100,
      killGraceMs: 100,
    })

    expect(result.ok).toBe(false)
    expect(result.peakMemoryMb).toBeNull()
    expect(result.error.type).toBe('parse-failed')
    expect(result.error.message).not.toContain('timeout secret')
  })

  it('resolves timeout failures when the child ignores SIGTERM', async () => {
    const researchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-run-sigterm-'))
    const sandboxRoot = path.join(researchRoot, 'parser-sandbox')
    const killSignals = []
    fs.mkdirSync(sandboxRoot, { recursive: true })
    fs.writeFileSync(path.join(sandboxRoot, 'package.json'), '{}')
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = (signal) => {
      killSignals.push(signal || 'SIGTERM')
      return true
    }

    const result = await runOne({
      parser: 'pptxtojson',
      deck: 'ignore-sigterm.pptx',
      inputPath: path.join(researchRoot, 'ignore-sigterm.pptx'),
      researchRoot,
      sandboxRoot,
      inventory: { deck: 'ignore-sigterm' },
      childPath: path.join(researchRoot, 'fake-child.js'),
      forkImpl: () => {
        setTimeout(() => child.stdout.emit('data', 'ignored signal secret'), 10)
        return child
      },
      timeoutMs: 100,
      killGraceMs: 100,
    })

    expect(result.ok).toBe(false)
    expect(result.peakMemoryMb).toBeNull()
    expect(result.error.type).toBe('parse-failed')
    expect(result.error.message).toContain('did not exit')
    expect(result.error.message).not.toContain('ignored signal secret')
    expect(killSignals).toEqual(['SIGTERM', 'SIGKILL'])
  })

  it('does not accept late child success messages after timeout', async () => {
    const researchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-run-late-result-'))
    const sandboxRoot = path.join(researchRoot, 'parser-sandbox')
    const child = new EventEmitter()
    fs.mkdirSync(sandboxRoot, { recursive: true })
    fs.writeFileSync(path.join(sandboxRoot, 'package.json'), '{}')
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => true

    const result = await runOne({
      parser: 'pptxtojson',
      deck: 'late-result.pptx',
      inputPath: path.join(researchRoot, 'late-result.pptx'),
      researchRoot,
      sandboxRoot,
      inventory: { deck: 'late-result' },
      childPath: path.join(researchRoot, 'fake-child.js'),
      forkImpl: () => {
        setTimeout(() => child.emit('message', {
          type: 'result',
          result: {
            parser: 'pptxtojson',
            deck: 'late-result.pptx',
            ok: true,
            error: null,
          },
        }), 50)
        setTimeout(() => child.emit('exit', 0), 75)
        return child
      },
      timeoutMs: 20,
      killGraceMs: 200,
    })

    expect(result.ok).toBe(false)
    expect(result.peakMemoryMb).toBeNull()
    expect(result.error.type).toBe('parse-failed')
    expect(result.error.message).toContain('timed out')
  })

  it('returns a sanitized failure for invalid child parser keys', async () => {
    const researchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-run-invalid-parser-'))
    const sandboxRoot = path.join(researchRoot, 'parser-sandbox')
    fs.mkdirSync(sandboxRoot, { recursive: true })
    fs.writeFileSync(path.join(sandboxRoot, 'package.json'), '{}')

    const result = await runOne({
      parser: 'unknown-parser',
      deck: 'invalid-parser.pptx',
      inputPath: path.join(researchRoot, 'invalid-parser.pptx'),
      researchRoot,
      sandboxRoot,
      inventory: { deck: 'invalid-parser' },
      timeoutMs: 1000,
      killGraceMs: 100,
    })

    expect(result.ok).toBe(false)
    expect(result.error.type).toBe('parse-failed')
    expect(result.error.message).toContain('Diagnostic redacted')
    expect(result.error.message).not.toContain('Unknown parser key')
  })
})
