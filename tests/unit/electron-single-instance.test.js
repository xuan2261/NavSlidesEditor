import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import singleInstanceModule from '../../electron/single-instance.js'

const { acquireSingleInstance, focusExistingWindow } = singleInstanceModule
const mainSource = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'electron', 'main.js'),
  'utf8'
)

describe('Electron single-instance ownership', () => {
  it('quits a second process before registering startup work', () => {
    const app = {
      requestSingleInstanceLock: vi.fn(() => false),
      quit: vi.fn(),
      on: vi.fn(),
    }

    expect(acquireSingleInstance({ app, onSecondInstance: vi.fn() })).toBe(false)
    expect(app.requestSingleInstanceLock).toHaveBeenCalledOnce()
    expect(app.quit).toHaveBeenCalledOnce()
    expect(app.on).not.toHaveBeenCalled()
  })

  it('registers the second-instance handler and restores/focuses the existing window', () => {
    const app = {
      requestSingleInstanceLock: vi.fn(() => true),
      quit: vi.fn(),
      on: vi.fn(),
    }
    const onSecondInstance = vi.fn()
    const window = {
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      focus: vi.fn(),
    }

    expect(acquireSingleInstance({ app, onSecondInstance })).toBe(true)
    focusExistingWindow(window)

    expect(app.on).toHaveBeenCalledWith('second-instance', onSecondInstance)
    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
  })

  it('acquires the lock before backend/window readiness is scheduled', () => {
    expect(mainSource.indexOf('acquireSingleInstance({')).toBeGreaterThan(-1)
    expect(mainSource.indexOf('acquireSingleInstance({')).toBeLessThan(
      mainSource.indexOf('app.whenReady()')
    )
  })
})
