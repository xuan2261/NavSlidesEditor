const { fork } = require('node:child_process')
const path = require('node:path')
module.exports = function launch(root) {
  const child = fork(path.join(__dirname, 'publication-acceptance-child.cjs'), [], {
    execArgv: [], silent: true, windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', NAVSLIDES_CRASH_TEST_HARNESS: '1',
      SLIDES_DATA_DIR: path.join(root, 'data'), SLIDES_UPLOADS_DIR: path.join(root, 'uploads') },
  })
  const messages = []
  const waiters = new Set()
  let exit
  let failure
  child.stdout.resume()
  child.stderr.resume()
  const closed = new Promise((resolve) => child.once('close', (code, signal) => {
    exit = { code, signal }; resolve(exit)
    for (const waiter of waiters) waiter.reject(new Error(`Child exited ${code}/${signal}`))
  }))
  child.on('error', (error) => {
    failure = error
    for (const waiter of waiters) waiter.reject(error)
  })
  child.on('message', (message) => {
    if (message?.type === 'failure') {
      failure = new Error(`Child failure: ${message.code}`)
      for (const waiter of waiters) waiter.reject(failure)
    } else {
      messages.push(message)
      for (const waiter of waiters) waiter.deliver()
    }
  })
  return {
    send: (message) => child.send(message),
    next(type) {
      return new Promise((resolve, reject) => {
        let timer
        const waiter = {
          reject(error) { clearTimeout(timer); waiters.delete(waiter); reject(error) },
          deliver() {
            const index = messages.findIndex((message) => message?.type === type)
            if (index < 0) return
            clearTimeout(timer); waiters.delete(waiter); resolve(messages.splice(index, 1)[0])
          },
        }
        timer = setTimeout(() => waiter.reject(new Error(`IPC deadline: ${type}`)), 90000)
        waiters.add(waiter)
        if (failure) waiter.reject(failure)
        else if (exit) waiter.reject(new Error('Child already exited'))
        else waiter.deliver()
      })
    },
    async kill() {
      if (!exit && !child.kill('SIGKILL')) throw new Error('Child termination rejected')
      return closed
    },
  }
}
