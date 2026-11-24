import { fork } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Test-only IPC controller: no sleeps, no user-server discovery or termination.
export function launchRecoveryChild(entry, root, mode, { nodeEnv = 'test' } = {}) {
  const child = fork(fileURLToPath(entry), [mode], {
    execArgv: [], silent: true, windowsHide: true,
    env: { ...process.env, NODE_ENV: nodeEnv, NAVSLIDES_CRASH_TEST_HARNESS: '1',
      SLIDES_DATA_DIR: path.join(root, 'data'), SLIDES_UPLOADS_DIR: path.join(root, 'uploads') },
  })
  const messages = []
  const waiters = new Set()
  let exited = false
  let failure
  let stderr = ''
  child.stdout.resume()
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000) })
  const closed = new Promise((resolve) => child.once('close', (code, signal) => {
    exited = true
    resolve({ code, signal })
    for (const waiter of waiters) waiter.reject(new Error(`Recovery child exited (${code}/${signal}): ${stderr}`))
  }))
  child.on('error', (error) => {
    failure = error
    for (const waiter of waiters) waiter.reject(error)
  })
  child.on('message', (message) => {
    if (!message || typeof message.type !== 'string') return
    if (message.type === 'failure') {
      failure = new Error(`Recovery child failure: ${message.code}`)
      for (const waiter of waiters) waiter.reject(failure)
      return
    }
    messages.push(message)
    for (const waiter of waiters) waiter.deliver()
  })
  return {
    child, closed,
    next(type) {
      return new Promise((resolve, reject) => {
        let timer
        const waiter = {
          reject(error) { clearTimeout(timer); waiters.delete(waiter); reject(error) },
          deliver() {
            const index = messages.findIndex((message) => message.type === type)
            if (index < 0) return
            clearTimeout(timer)
            waiters.delete(waiter)
            resolve(messages.splice(index, 1)[0])
          },
        }
        timer = setTimeout(() => waiter.reject(new Error(`Recovery child checkpoint timeout: ${type}`)), 15000)
        waiters.add(waiter)
        if (failure) waiter.reject(failure)
        else if (exited) waiter.reject(new Error('Recovery child already exited'))
        else waiter.deliver()
      })
    },
    async kill() {
      if (!exited && !child.kill('SIGKILL')) throw new Error('Recovery child termination was not accepted')
      return closed
    },
  }
}
